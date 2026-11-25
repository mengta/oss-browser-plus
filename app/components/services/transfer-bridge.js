// Vue3-B3 前置：传输主进程化桥接（G0 留痕"传输/升级完整主进程化"）
// 渲染层不再 require('./node/ossstore')，上传/下载 job 经 window.ossBrowser.transfer 白名单创建，
// job 状态/进度经 transfer:progress 广播驱动本地适配对象（事件语义与 ossstore job 等价）。
angular.module('web').factory('TransferBridge', [
  function() {
    var jobsByTaskId = {};
    var subscribed = false;

    function transferApi() {
      return (typeof window !== 'undefined' && window.ossBrowser) ? window.ossBrowser.transfer : null;
    }

    function ensureSubscribed() {
      if (subscribed) { return; }
      subscribed = true;
      var transfer = transferApi();
      if (!transfer || typeof transfer.subscribe !== 'function') { return; }
      transfer.subscribe(function(payload) {
        if (!payload || !payload.taskId) { return; }
        var job = jobsByTaskId[payload.taskId];
        if (job) { job._applyPayload(payload); }
      });
    }

    function buildAuthPayload(auth, endpoint) {
      var p = {
        accessKeyId: auth.id,
        accessKeySecret: auth.secret,
        endpoint: endpoint
      };
      if (auth.stoken && auth.id.indexOf('STS.') == 0) { p.securityToken = auth.stoken; }
      return p;
    }

    function invokeControl(action, taskId) {
      var transfer = transferApi();
      if (!transfer || typeof transfer[action] !== 'function') { return; }
      transfer[action](taskId);
    }

    // type: 'upload' | 'download'
    // endpoint: getOssEndpoint 计算好的完整 endpoint URL
    function createJob(auth, opt, type, endpoint) {
      ensureSubscribed();

      var listeners = {};
      var taskId = null;
      var taskQueue = [];
      var lastEmitAt = 0;

      var job = {
        region: opt.region,
        from: opt.from,
        to: opt.to,
        status: 'waiting',
        prog: { loaded: 0, total: (type === 'upload' && opt.from && opt.from.size) || 0 },
        checkPoints: opt.checkPoints || undefined,
        speed: 0,
        message: '',
        ecCode: '',
        requestId: '',
        crc64Str: opt.crc64Str || undefined,
        hashCrc64ecma: opt.hashCrc64ecma || undefined,

        on: function(name, fn) {
          (listeners[name] = listeners[name] || []).push(fn);
          return job;
        },

        start: function() {
          if (taskId) { invokeControl('resume', taskId); } else { taskQueue.push('resume'); }
        },

        stop: function() {
          if (taskId) { invokeControl('pause', taskId); } else { taskQueue.push('pause'); }
        },

        _emit: function(name) {
          var args = Array.prototype.slice.call(arguments, 1);
          var arr = listeners[name] || [];
          for (var i = 0; i < arr.length; i++) { arr[i].apply(null, args); }
        },

        _applyPayload: function(payload) {
          var prev = job.status;
          job.status = payload.status || prev;
          if (payload.prog) {
            job.prog = {
              loaded: payload.prog.loaded || 0,
              total: payload.prog.total || job.prog.total
            };
          }
          if (typeof payload.speed === 'number' && payload.speed !== job.speed) {
            job.speed = payload.speed;
            job._emit('speedChange', payload.speed);
          }
          job.message = payload.message || '';
          job.ecCode = payload.ecCode || '';
          job.requestId = payload.requestId || '';
          if (payload.checkPoints) { job.checkPoints = payload.checkPoints; }
          if (payload.crc64Str) { job.crc64Str = payload.crc64Str; }
          if (payload.hashCrc64ecma) { job.hashCrc64ecma = payload.hashCrc64ecma; }

          if (payload.status !== prev) {
            job._emit('statuschange', payload.status, payload.retryTimes || 0);
          }

          // 进度驱动 digest/saveProg：状态变化立即，否则 200ms 节流（等价原 partcomplete 分片刷新粒度）
          var now = Date.now();
          if (payload.status !== prev || now - lastEmitAt >= 200) {
            lastEmitAt = now;
            job._emit('partcomplete', job.prog);
          }

          if (payload.status === 'finished') { job._emit('complete'); }
          if (payload.status === 'failed') {
            job._emit('error', {
              message: payload.message || '',
              ecCode: payload.ecCode || '',
              requestId: payload.requestId || ''
            });
          }
        },

        _fail: function(code, message) {
          job.status = 'failed';
          job.message = message || code;
          job.ecCode = code;
          job._emit('statuschange', 'failed');
          job._emit('error', { message: job.message, ecCode: code });
        }
      };

      var transfer = transferApi();
      if (!transfer || typeof transfer[type === 'upload' ? 'createUpload' : 'createDownload'] !== 'function') {
        setTimeout(function() { job._fail('UNAVAILABLE', 'transfer bridge unavailable'); }, 0);
        return job;
      }

      var createFn = type === 'upload' ? 'createUpload' : 'createDownload';
      transfer[createFn](buildAuthPayload(auth, endpoint), opt).then(function(res) {
        if (res && res.ok && res.data && res.data.taskId) {
          taskId = res.data.taskId;
          jobsByTaskId[taskId] = job;
          var queued = taskQueue;
          taskQueue = [];
          for (var i = 0; i < queued.length; i++) { invokeControl(queued[i], taskId); }
        } else {
          job._fail((res && res.code) || 'INTERNAL', (res && res.message) || 'create ' + type + ' job failed');
        }
      }, function(err) {
        job._fail('INTERNAL', (err && err.message) || String(err));
      });

      return job;
    }

    return {
      createJob: createJob,
      buildAuthPayload: buildAuthPayload
    };
  }
]);