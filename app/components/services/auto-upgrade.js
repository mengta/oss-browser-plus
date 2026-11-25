angular.module('web').factory('autoUpgradeSvs', [
  'settingsSvs',
  function(settingsSvs) {
    // Vue3-B3 前置：升级链路主进程化（G0 留痕"传输/升级完整主进程化"）。
    // 渲染层零 require：升级包下载/校验/改名由主进程 upgrade 白名单承接，
    // 状态经 upgrade:state 广播（idle|checking|downloading|ready|failed）映射为原 job 语义。
    var NAME = 'oss-browser';
    var __plat = (function () {
      try {
        var boot = window.ossBrowser.bootstrap.get();
        return boot && boot.ok ? boot.data : {};
      } catch (e) { return {}; }
    })();

    var release_notes_url = Global.release_notes_url;
    var upgrade_url = Global.upgrade_url;
    var gVersion = Global.app.version;

    var upgradeOpt = {
      currentVersion: gVersion,
      isLastVersion: false,
      lastVersion: gVersion,
      fileName: '',
      link: '',
      upgradeJob: {
        pkgLink: '',
        progress: 0,
        status: 'waiting'
      }
    };

    var job;
    var currentJob = null;

    return {
      load: load,
      start: start,

      compareVersion: compareVersion,
      getReleaseNote: getReleaseNote,
      getLastestReleaseNote: getLastestReleaseNote
    };

    function upgradeApi() {
      return (typeof window !== 'undefined' && window.ossBrowser) ? window.ossBrowser.upgrade : null;
    }

    function ensureUpgradeSubscribed() {
      var api = upgradeApi();
      if (!api || typeof api.subscribe !== 'function') { return; }
      if (ensureUpgradeSubscribed._subId) { return; }
      ensureUpgradeSubscribed._subId = api.subscribe(function(payload) {
        var j = currentJob;
        if (!j || !payload) { return; }
        if (typeof payload.percent === 'number' && payload.percent !== j.progress) {
          j.progress = payload.percent;
          j._changeProgress(payload.percent);
        }
        if (payload.state) {
          var mapped;
          if (payload.state === 'ready') { mapped = 'finished'; }
          else if (payload.state === 'downloading') { mapped = 'running'; }
          else if (payload.state === 'checking') { mapped = 'verifying'; }
          else if (payload.state === 'failed') { mapped = 'failed'; }
          else { mapped = payload.state; }
          if (mapped !== j.status) {
            j._changeStatus(mapped, payload.message || '');
          }
        }
      });
    }

    function start() {
      if (job && job.status !== 'running') {
        job.start();
      }
    }

    function getReleaseNote(version, lang, fn) {
      if (compareVersion(version, '1.5.1') <= 0) { $.get('../release-notes/' + version + '.md', fn); } else { $.get('../release-notes/' + version + '.' + lang + '.md', fn); }
    }

    // 获取最新releaseNote
    function getLastestReleaseNote(version, lang, fn) {
      if (compareVersion(version, '1.5.1') <= 0) { $.get(release_notes_url + version + '.md', fn); } else { $.get(release_notes_url + version + '.' + lang + '.md', fn); }
    }

    // 升级下载 job：执行体在主进程（upgrade.download），本地仅维护状态映射
    function FlatDownloadJob(version, from, fileName) {
      var self = this;
      var _statusChangeFn;
      var _progressChangeFn;

      this.version = version;
      this.from = from;
      this.fileName = fileName;
      this.total = 0;
      this.progress = 0;
      this.status = 'waiting';
      this.message = '';

      ensureUpgradeSubscribed();
      currentJob = this;

      this.update = function() {}; // 主进程内部完成校验与改名，结果经 upgrade:state 广播
      this.check = function(crc, md5, fn) { if (typeof fn === 'function') { fn(null); } };
      this.precheck = function() {
        this.progress = 0;
        this.total = 0;
      };
      this.start = function() {
        var api = upgradeApi();
        if (!api || typeof api.download !== 'function') {
          this._changeStatus('failed', { message: 'upgrade bridge unavailable' });
          return;
        }
        api.download({ version: version, url: from, fileName: fileName }).then(function(res) {
          if (!res || !res.ok) {
            self._changeStatus('failed', (res && res.message) || 'download failed');
          }
          // 成功路径状态经 upgrade:state 广播（downloading→running，ready→finished）
        }, function(err) {
          self._changeStatus('failed', (err && err.message) || String(err));
        });
      };
      // 原版升级下载同样无暂停入口，stop 语义为空
      this.stop = function() {};
      this.onProgressChange = function(fn) {
        _progressChangeFn = fn;
      };
      this.onStatusChange = function(fn) {
        _statusChangeFn = fn;
      };
      this._changeStatus = function(status, err) {
        this.status = status;
        this.message = err;

        if (_statusChangeFn) { _statusChangeFn(status); }
      };
      this._changeProgress = function(prog) {
        if (_progressChangeFn) { _progressChangeFn(prog); }
      };
    }

    function load(fn) {
      $.getJSON(upgrade_url, function(data) {
        var isLastVersion = compareVersion(gVersion, data.version) >= 0;
        var lastVersion = data.version;

        upgradeOpt.isLastVersion = isLastVersion;
        upgradeOpt.lastVersion = lastVersion;

        var fileName =
          NAME + '-' + __plat.platform + '-' + __plat.arch + '.zip';

        if (isLastVersion) {
          // 无需更新

          var link =
            data.package_url.replace(/(\/*$)/g, '') +
            '/' +
            data.version +
            '/' +
            fileName;

          console.log('download url:', link);

          fn({
            currentVersion: gVersion,
            isLastVersion: isLastVersion,
            lastVersion: lastVersion,
            fileName: fileName,
            link: link
          });

          return;
        }

        getFasterUrl(data.package_urls, lastVersion, function(linkPre) {
          if (data.files) {
            // 暂时只支持1个文件更新
            data.file = data.files.length > 0 ? data.files[0] : null;

            // 增量更新
            upgradeOpt.fileName = fileName;
            upgradeOpt.link = linkPre + '/' + fileName;
            upgradeOpt.upgradeJob.status = 'waiting';
            upgradeOpt.upgradeJob.progress = 0;
            upgradeOpt.upgradeJob.pkgLink =
              linkPre +
              '/' +
              __plat.platform +
              '-' +
              __plat.arch +
              '/' +
              data.file;

            job = new FlatDownloadJob(lastVersion, upgradeOpt.upgradeJob.pkgLink, data.file);

            job.onStatusChange(function(status) {
              upgradeOpt.upgradeJob.status = status;
            });
            job.onProgressChange(function(progress) {
              upgradeOpt.upgradeJob.progress = progress;
            });
            job.precheck();

            fn(upgradeOpt);

            return;
          }

          // 全量更新
          var link = linkPre + '/' + fileName;

          console.log('download url:', link);

          fn({
            files: data.files,
            currentVersion: gVersion,
            isLastVersion: isLastVersion,
            lastVersion: lastVersion,
            fileName: fileName,
            link: link
          });
        }); // end getFasterUrl
      });
    }

    function getFasterUrl(arr, lastVersion, fn) {
      var fileName =
        NAME + '-' + __plat.platform + '-' + __plat.arch + '.zip';
      var c = 0;
      var t = [];

      _dig();
      function _dig() {
        var t1 = Date.now();
        var linkPre = arr[c].replace(/(\/*$)/g, '') + '/' + lastVersion;

        $.ajax({
          timeout: 5000,
          url: linkPre + '/' + fileName,
          headers: {
            Range: 'bytes=30-210'
          }
        }).then(
            function(data) {
              var t2 = Date.now();

              t.push({ time: t2 - t1, linkPre: linkPre });

              c++;

              if (c >= arr.length) { callback(); } else { _dig(); }
            },
            function(err) {
              var t2 = Date.now();

              t.push({ time: t2, linkPre: linkPre });
              console.log(arr[c], err);

              c++;

              if (c >= arr.length) { callback(); } else { _dig(); }
            }
        );
      }
      function callback() {
        t.sort(function(a, b) {
          return a.time > b.time ? 1 : -1;
        });
        console.log('getFasterUrl:', JSON.stringify(t, ' ', 2));
        fn(t[0].linkPre);
      }
    }

    function compareVersion(curV, lastV) {
      var arr = curV.split('.');
      var arr2 = lastV.split('.');

      var len = Math.max(arr.length, arr2.length);

      for (var i = 0; i < len; i++) {
        var a = parseInt(arr[i]);
        var b = parseInt(arr2[i]);

        if (a > b) {
          return 1;
        }

        if (a < b) {
          return -1;
        }
      }

      return 0;
    }
  }
]);
