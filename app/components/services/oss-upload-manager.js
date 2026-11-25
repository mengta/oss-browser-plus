angular.module('web').factory('ossUploadManager', [
  '$q',
  '$state',
  '$timeout',
  'ossSvs2',
  'AuthInfo',
  'Toast',
  'Const',
  'DelayDone',
  'safeApply',
  'settingsSvs',
  'ProgNaming',
  'TransferBridge',
  function(
      $q,
      $state,
      $timeout,
      ossSvs2,
      AuthInfo,
      Toast,
      Const,
      DelayDone,
      safeApply,
      settingsSvs,
      ProgNaming,
      TransferBridge
  ) {
    // Vue3-B3 前置：OssStore 下沉主进程（transfer 白名单承载），渲染层零 require
    var fs = null;
    function bridgeStorage() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.storage || null;
    }

    var pathApi = {
      dirname: function (target) { return sysCall('pathDirname', [target]); },
      join: function () { return sysCall('pathJoin', [Array.prototype.slice.call(arguments)]); },
      basename: function (target) { return sysCall('pathBasename', [target]); },
      relative: function (from, to) { return sysCall('pathRelative', [from, to]); },
      sep: (function () {
        try {
          var boot = window.ossBrowser.bootstrap.get();
          return boot && boot.ok && boot.data.platform === 'win32' ? '\\' : '/';
        } catch (e) { return '/'; }
      })()
    };

    function sysCall(method, args) {
      var api = (typeof window !== 'undefined' && window.ossBrowser) ? window.ossBrowser.system : null;
      if (!api || typeof api[method] !== 'function') { return ''; }
      var res = api[method].apply(null, args);
      return res && res.ok ? res.data : '';
    }

    function parseJobs(content) {
      try { return JSON.parse(content || '[]'); } catch (e) { return []; }
    }

    var stopCreatingFlag = false;

    var concurrency = 0;

    var $scope;

    return {
      init: init,
      createUploadJobs: createUploadJobs,
      checkStart: checkStart,
      saveProg: saveProg,

      stopCreatingJobs: function() {
        stopCreatingFlag = true;
      }
    };

    function init(scope) {
      $scope = scope;
      concurrency = 0;
      $scope.lists.uploadJobList = [];
      $scope.retryTimes = 0;

      var authInfo = AuthInfo.get();

      loadProg().then(function(arr) {
        angular.forEach(arr, function(n) {
          // console.log(n,'<=====');
          var job = createJob(authInfo, n);

          if (
            job.status == 'waiting' ||
            job.status == 'running' ||
            job.status == 'verifying' ||
            job.status == 'retrying'
          ) { job.stop(); }

          addEvents(job);
        });
      });
    }

    function addEvents(job) {
      $scope.lists.uploadJobList.push(job);
      // $scope.calcTotalProg();
      safeApply($scope);
      checkStart();

      // save
      saveProg();

      job.on('partcomplete', function(prog) {
        safeApply($scope);
        // save
        saveProg();
      });

      job.on('statuschange', function(status, retryTimes) {
        if (status == 'stopped') {
          concurrency--;
          $timeout(checkStart, 100);
        }

        if (status == 'retrying') {
          $scope.retryTimes = retryTimes;
        }

        safeApply($scope);
        // save
        saveProg();
      });
      job.on('speedChange', function() {
        safeApply($scope);
      });

      job.on('complete', function() {
        concurrency--;
        checkStart();
        checkNeedRefreshFileList(job.to.bucket, job.to.key);
        // $scope.$emit('needrefreshfilelists');
      });
      job.on('error', function(err) {
        console.error(err);
        concurrency--;
        checkStart();
      });
    }

    function checkStart() {
      // 流控, 同时只能有 n 个上传任务.
      var maxConcurrency = settingsSvs.maxUploadJobCount.get();

      // console.log(concurrency , maxConcurrency);
      concurrency = Math.max(0, concurrency);

      if (concurrency < maxConcurrency) {
        var arr = $scope.lists.uploadJobList;

        for (var i = 0; i < arr.length; i++) {
          if (concurrency >= maxConcurrency) { return; }

          var n = arr[i];

          if (n.status == 'waiting') {
            n.start();
            concurrency++;
          }
        }
      }
    }

    function checkNeedRefreshFileList(bucket, key) {
      if ($scope.currentInfo.bucket == bucket) {
        var p = pathApi.dirname(key) + '/';

        p = p == './' ? '' : p;

        if ($scope.currentInfo.key == p) {
          $scope.$emit('needrefreshfilelists');
        }
      }
    }

    /**
     * 上传
     * @param filePaths []  {array<string>}  有可能是目录，需要遍历
     * @param bucketInfo {object} {bucket, region, key}
     * @param jobsAddingFn {Function} 快速加入列表回调方法， 返回jobs引用，但是该列表长度还在增长。
     * @param jobsAddedFn {Function} 加入列表完成回调方法， jobs列表已经稳定
     */
    function createUploadJobs(filePaths, bucketInfo, jobsAddingFn) {
      stopCreatingFlag = false;
      // console.log('--------uploadFilesHandler:',  filePaths, bucketInfo);

      var authInfo = AuthInfo.get();

      digArr(filePaths, function() {
        if (jobsAddingFn) { jobsAddingFn(); }
      });

      function digArr(filePaths, fn) {
        var t = [];
        var len = filePaths.length;
        var c = 0;

        function _dig() {
          var n = filePaths[c];
          var dirPath = pathApi.dirname(n);

          if (stopCreatingFlag) { return; }

          dig(filePaths[c], dirPath, function(jobs) {
            t = t.concat(jobs);
            c++;

            if (c >= len) {
              fn(t);
            } else {
              _dig();
            }
          });
        }

        _dig();
      }

      function loop(parentPath, dirPath, arr, callFn) {
        var t = [];
        var len = arr.length;
        var c = 0;

        if (len == 0) { callFn([]); } else { inDig(); }

        // 串行
        function inDig() {
          dig(pathApi.join(parentPath, arr[c]), dirPath, function(jobs) {
            t = t.concat(jobs);
            c++;

            // console.log(c,'/',len);
            if (c >= len) { callFn(t); } else {
              if (stopCreatingFlag) {
                return;
              }

              inDig();
            }
          });
        }
      }

      function dig(absPath, dirPath, callFn) {
        if (stopCreatingFlag) {
          return;
        }

        var fileName = pathApi.basename(absPath);

        var filePath = pathApi.relative(dirPath, absPath);

        if (pathApi.sep != '/') {
          // 修复window下 \ 问题
          filePath = filePath.replace(/\\/g, '/');
        }

        // 修复window下 \ 问题
        filePath = bucketInfo.key
          ? bucketInfo.key.replace(/(\/*$)/g, '') + '/' + filePath
          : filePath;

        if (fs && fs.statSync(absPath).isDirectory()) {
          // 创建目录
          ossSvs2
              .createFolder(bucketInfo.region, bucketInfo.bucket, filePath + '/')
              .then(function() {
              // 判断是否刷新文件列表
                checkNeedRefreshFileList(bucketInfo.bucket, filePath + '/');
              });

          // 递归遍历目录
          // var t = [];
          // var arr = fs.readdirSync(absPath);
          // arr.forEach(function (fname) {
          //   var ret = dig(pathApi.join(absPath, fname), dirPath);
          //   t = t.concat(ret);
          // });

          if (fs) fs.readdir(absPath, function(err, arr) {
            if (err) {
              console.log(err.stack);
            } else {
              loop(absPath, dirPath, arr, function(jobs) {
                $timeout(function() {
                  callFn(jobs);
                }, 1);
              });
            }
          });
        } else {
          // 文件
          var job = createJob(authInfo, {
            region: bucketInfo.region,
            from: {
              name: fileName,
              path: absPath
            },
            to: {
              bucket: bucketInfo.bucket,
              key: filePath
            }
          });

          addEvents(job);

          $timeout(function() {
            callFn([job]);
          }, 1);
        }
      }
    }

    /**
       * 创建单个job（Vue3-B3 前置：经 TransferBridge 走主进程 transfer 白名单）
       * @param  auth { id, secret}
       * @param  opt   { region, from, to, progress, checkPoints, ...}
       * @param  opt.from {name, path}
       * @param  opt.to   {bucket, key}
       ...
       * @return job  { start(), stop(), status, progress }
       job.events: statuschange, progress
       */
    function createJob(auth, opt) {
      var cname = AuthInfo.get().cname || false;
      var endpointname = cname ? auth.eptplcname : auth.eptpl;
      var endpoint = ossSvs2.getOssEndpoint(
          opt.region,
          opt.to.bucket,
          endpointname
      );

      return TransferBridge.createJob(auth, opt, 'upload', endpoint);
    }

    /**
     * 保存进度
     */
    function saveProg() {
      DelayDone.delayRun(
          'save_upload_prog',
          1000,
          function() {
            var t = [];

            angular.forEach($scope.lists.uploadJobList, function(n) {
              if (n.status == 'finished') { return; }

              if (n.checkPoints && n.checkPoints.chunks) {
                var checkPoints = angular.copy(n.checkPoints);

                delete checkPoints.chunks;
              }

              t.push({
                crc64Str: n.crc64Str,
                checkPoints: checkPoints,
                region: n.region,
                to: n.to,
                from: n.from,
                status: n.status,
                message: n.message,
                ecCode: n.ecCode,
                requestId: n.requestId,
                prog: n.prog
              });
            });

            // console.log('request save upload:', t);
            var storage = bridgeStorage();
            if (storage) {
              storage.writeProgress(getUpProgFilePath(), JSON.stringify(t)).then(
                function(res) { if (!res || !res.ok) { console.error('[upload] saveProg failed'); } },
                function() { console.error('[upload] saveProg failed'); }
              );
            }
            $scope.calcTotalProg();
          },
          20
      );
    }

    /**
     * 获取保存的进度
     */
    function loadProg() {
      var storage = bridgeStorage();
      if (!storage) { return Promise.resolve([]); }

      var newName = getUpProgFilePath();
      var legacyName = getUpProgLegacyFilePath();

      return storage.readProgress(newName).then(function(res) {
        if (res && res.ok && res.data && res.data.exists) {
          return parseJobs(res.data.content);
        }
        return storage.readProgress(legacyName).then(function(lr) {
          if (!lr || !lr.ok || !lr.data || !lr.data.exists) { return []; }
          var jobs = parseJobs(lr.data.content);
          return storage.writeProgress(newName, JSON.stringify(jobs)).then(
            function() { return jobs; },
            function() { return jobs; }
          );
        });
      }).catch(function() { return []; });
    }

    // 上传进度保存路径（CS-03：sha256 脱敏命名，D-6）
    function getUpProgFilePath() {
      return ProgNaming.newProgFileName('upprog_', AuthInfo.get().id || '');
    }

    function getUpProgLegacyFilePath() {
      return ProgNaming.legacyProgFileName('upprog_', AuthInfo.get().id || '');
    }
  }
]);
