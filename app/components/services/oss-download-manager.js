angular.module('web').factory('ossDownloadManager', [
  '$q',
  '$state',
  '$timeout',
  'AuthInfo',
  'ossSvs2',
  'Toast',
  'Const',
  'DelayDone',
  'safeApply',
  'settingsSvs',
  'ProgNaming',
  function(
      $q,
      $state,
      $timeout,
      AuthInfo,
      ossSvs2,
      Toast,
      Const,
      DelayDone,
      safeApply,
      settingsSvs,
      ProgNaming
  ) {
    var OssStore = null;
    try { OssStore = require('./node/ossstore'); } catch (e) { OssStore = null; }
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
      createDownloadJobs: createDownloadJobs,
      checkStart: checkStart,
      saveProg: saveProg,

      stopCreatingJobs: function() {
        stopCreatingFlag = true;
      }
    };

    function init(scope) {
      $scope = scope;
      concurrency = 0;
      $scope.lists.downloadJobList = [];
      $scope.retryTimes = 0;
      // console.log('----load saving download jobs');

      var authInfo = AuthInfo.get();

      loadProg().then(function(arr) {
        angular.forEach(arr, function(n) {
          var job = createJob(authInfo, n);

          if (
            job.status == 'waiting' ||
            job.status == 'running' ||
            job.status == 'verifying'
          ) { job.stop(); }

          addEvents(job);
        });
      });
    }

    function addEvents(job) {
      $scope.lists.downloadJobList.push(job);
      $scope.calcTotalProg();
      safeApply($scope);
      checkStart();

      // save
      saveProg();

      job.on('partcomplete', function(prog) {
        safeApply($scope);
        // save
        saveProg($scope);
      });

      job.on('statuschange', function(status, retryTimes) {
        if (status == 'stopped') {
          concurrency--;
          checkStart();
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
        // $scope.$emit('needrefreshfilelists');
      });

      job.on('error', function(err) {
        console.error(err);
        concurrency--;
        checkStart();
      });
    }

    // 流控, 同时只能有 n 个上传任务.
    function checkStart() {
      var maxConcurrency = settingsSvs.maxDownloadJobCount.get();

      // console.log(concurrency , maxConcurrency);
      concurrency = Math.max(0, concurrency);

      if (concurrency < maxConcurrency) {
        var arr = $scope.lists.downloadJobList;

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

    /**
     * 下载
     * @param fromOssInfos {array}  item={region, bucket, path, name, size=0, isFolder=false}  有可能是目录，需要遍历
     * @param toLocalPath {string}
     * @param jobsAddedFn {Function} 加入列表完成回调方法， jobs列表已经稳定
     */
    function createDownloadJobs(fromOssInfos, toLocalPath, jobsAddedFn) {
      stopCreatingFlag = false;
      // console.log('--------downloadFilesHandler', fromOssInfos, toLocalPath);
      var authInfo = AuthInfo.get();
      var dirPath = pathApi.dirname(fromOssInfos[0].path);

      loop(
          fromOssInfos,
          function(jobs) {},
          function() {
            if (jobsAddedFn) { jobsAddedFn(); }
          }
      );

      function loop(arr, callFn, callFn2) {
        var t = [];
        var len = arr.length;
        var c = 0;
        var c2 = 0;

        if (len == 0) {
          callFn(t);
          callFn2(t);

          return;
        }

        _kdig();

        async function _kdig() {
          await dig(
              arr[c],
              t,
              function() {},
              function() {
                c2++;

                if (c2 >= len) {
                  callFn2(t);
                }
              }
          );
          c++;

          if (c == len) {
            callFn(t);
          } else {
            if (stopCreatingFlag) {
              return;
            }

            $timeout(_kdig, 10);
          }
        }

        // angular.forEach(arr, function (n) {
        //   dig(n, function (jobs) {
        //     t = t.concat(jobs);
        //     c++;
        //     console.log(c,'/',len);
        //     if (c == len) callFn(t);
        //   });
        // });
      }

      async function dig(ossInfo, t, callFn, callFn2) {
        if (stopCreatingFlag) {
          return;
        }

        var fileName = pathApi.basename(ossInfo.path);
        var filePath = pathApi.join(
            toLocalPath,
            pathApi.relative(dirPath, ossInfo.path)
        );

        if (ossInfo.isFolder) {
          // 目录
          if (fs) fs.mkdir(filePath, function(err) {
            if (err && err.code != 'EEXIST') {
              Toast.error('创建目录[' + filePath + ']失败:' + err.message);

              return;
            }

            // 遍历 oss 目录
            function progDig(marker) {
              ossSvs2
                  .listFiles(ossInfo.region, ossInfo.bucket, ossInfo.path, marker)
                  .then(function(result) {
                    var arr2 = result.data;

                    arr2.forEach(function(n) {
                      n.region = ossInfo.region;
                      n.bucket = ossInfo.bucket;
                    });
                    loop(
                        arr2,
                        function(jobs) {
                          t = t.concat(jobs);

                          if (result.marker) {
                            $timeout(function() {
                              progDig(result.marker);
                            }, 10);
                          } else if (callFn) { callFn(); }
                        },
                        callFn2
                    );
                  });
            }

            progDig();
          });
        } else {
          // 文件
          if (pathApi.sep == '\\') {
            // 修复window下，文件名含非法字符需要转义
            // eslint-disable-next-line no-useless-escape
            if (/[\/\\\:\<\>\?\*\"\|]/.test(fileName)) {
              fileName = encodeURIComponent(fileName);
              filePath = pathApi.join(
                  pathApi.dirname(filePath),
                  encodeURIComponent(pathApi.basename(filePath))
              );
            }
          }

          let truePath = ossInfo.path;

          if (ossInfo.type === 'Symlink') {
            truePath = (
              await ossSvs2.loadObjectSymlinkMeta(
                  ossInfo.region,
                  ossInfo.bucket,
                  ossInfo.path
              )
            ).targetName;
          }

          var job = createJob(authInfo, {
            region: ossInfo.region,
            from: {
              bucket: ossInfo.bucket,
              key: truePath
            },
            to: {
              name: fileName,
              path: filePath
            }
          });

          addEvents(job);

          t.push(job);

          if (callFn) { callFn(); }

          if (callFn2) { callFn2(); }
        }
      }
    }

    /**
     * @param  auth {id, secret}
     * @param  opt { region, from, to, ...}
     * @param  opt.from {bucket, key}
     * @param  opt.to   {name, path}
     * @return job  { start(), stop(), status, progress }
     */
    function createJob(auth, opt) {
      if (!OssStore) {
        return {
          region: opt.region,
          from: opt.from,
          to: opt.to,
          status: 'error',
          prog: { loaded: 0, total: (opt.from && opt.from.size) || 0 },
          checkPoints: opt.checkPoints,
          message: '传输能力待 B3 迁移',
          on: function() {},
          start: function() {},
          stop: function() {}
        };
      }
      var cname = AuthInfo.get().cname || false;

      var endpointname = cname ? auth.eptplcname : auth.eptpl;

      // stsToken
      if (auth.stoken && auth.id.indexOf('STS.') == 0) {
        var store = new OssStore({
          stsToken: {
            Credentials: {
              AccessKeyId: auth.id,
              AccessKeySecret: auth.secret,
              SecurityToken: auth.stoken
            }
          },
          endpoint: ossSvs2.getOssEndpoint(
              opt.region,
              opt.from.bucket,
              endpointname
          ),
          cname: cname
        });
      } else {
        var store = new OssStore({
          aliyunCredential: {
            accessKeyId: auth.id,
            secretAccessKey: auth.secret
          },
          endpoint: ossSvs2.getOssEndpoint(
              opt.region,
              opt.from.bucket,
              endpointname
          ),
          cname: cname
        });
      }

      return store.createDownloadJob(opt);
    }

    function saveProg() {
      // console.log('request save:', t);
      DelayDone.delayRun(
          'save_download_prog',
          1000,
          function() {
            var t = [];

            angular.forEach($scope.lists.downloadJobList, function(n) {
              if (n.status == 'finished') { return; }

              t.push({
                checkPoints: n.checkPoints,
                region: n.region,
                to: n.to,
                from: n.from,
                message: n.message,
                status: n.status,
                prog: n.prog,
                hashCrc64ecma: n.hashCrc64ecma
              });
            });
            // console.log('save:', t);

            var storage = bridgeStorage();
            if (storage) {
              storage.writeProgress(getDownProgFilePath(), JSON.stringify(t)).then(
                function(res) { if (!res || !res.ok) { console.error('[download] saveProg failed'); } },
                function() { console.error('[download] saveProg failed'); }
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

      var newName = getDownProgFilePath();
      var legacyName = getDownProgLegacyFilePath();

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

    // 下载进度保存路径（CS-03：sha256 脱敏命名，D-6）
    function getDownProgFilePath() {
      return ProgNaming.newProgFileName('downprog_', AuthInfo.get().id || '');
    }

    function getDownProgLegacyFilePath() {
      return ProgNaming.legacyProgFileName('downprog_', AuthInfo.get().id || '');
    }
  }
]);
