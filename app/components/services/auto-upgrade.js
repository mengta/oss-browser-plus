angular.module('web').factory('autoUpgradeSvs', [
  'settingsSvs',
  function(settingsSvs) {
    var util = null;
    try { util = require('./node/ossstore/lib/util'); } catch (e) { util = null; }
    var fs = null;
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
    // var config_path = Global.config_path;

    var upgradeOpt = {
      currentVersion: gVersion,
      isLastVersion: false,
      lastVersion: gVersion,
      fileName: '',
      link: '',
      // fileName: fileName,
      // link: linkPre + '/'+ fileName,
      upgradeJob: {
        pkgLink: '',
        progress: 0,
        status: 'waiting'
      }
    };

    return {
      load: load,
      start: start,

      compareVersion: compareVersion,
      getReleaseNote: getReleaseNote,
      getLastestReleaseNote: getLastestReleaseNote
    };

    var job;

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

    function FlatDownloadJob(name, from, to) {
      console.log('FlatDownloadJob:', from, to);
      this.total = 0;
      this.progress = 0;
      this.name = name;
      this.from = from;
      this.to = to;

      var _statusChangeFn;
      var _progressChangeFn;

      this.update = function() {
        // copy
        console.log('copy:', __dirname);
        fs.renameSync(to + '.download', to);
        this._changeStatus('finished');
      };
      this.check = function(crc, md5, fn) {
        // crc
        console.log('crc64 check');

        if (!util) {
          if (typeof fn === 'function') { fn(null); }
          return;
        }

        return util.checkFileHash(to + '.download', crc, md5, fn);
      };

      this.precheck = function() {
        this.progress = 0;
        this.total = 0;

        if (fs.existsSync(to)) {
          console.log('exists, done');
          this.progress = 100;
          this._changeStatus('finished');
        }
      };

      this.start = function() {
        this.progress = 0;
        this.total = 0;
        var that = this;

        if (fs.existsSync(to)) {
          console.log('exists, done');
          this.progress = 100;
          this._changeStatus('finished');

          return;
        }

        if (fs.existsSync(to + '.download')) {
          fs.unlinkSync(to + '.download');
        }

        console.log('start download ...');
        that._changeStatus('running');

        // P4-01：request 包已废弃（npm request deprecated），改用原生 fetch（Chromium 内置）
        // 等价复刻原 request.head + request(from).pipe(ws) 行为
        fetch(from, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
            .then(function(response) {
              console.log(response.status);

              if (response.status != 200) {
                that._changeStatus('failed', response);
                return;
              }

              that.total =
                  parseInt(response.headers.get('content-length') || '0');
              var hashCrc64ecma = response.headers.get('x-oss-hash-crc64ecma');
              var contentMd5 = response.headers.get('content-md5');

              var current = 0;
              that.progress = Math.round((current * 10000) / that.total) / 100;
              console.log(that.total);

              fetch(from)
                  .then(function(res) {
                    if (!res.ok) {
                      that._changeStatus('failed', res);
                      return;
                    }

                    var ws = fs.createWriteStream(to + '.download', { flags: 'a+' });
                    var reader = res.body.getReader();

                    function pump() {
                      reader.read()
                          .then(function(r) {
                            if (r.done) {
                              ws.end(function() {
                                that._changeStatus('verifying');

                                that.check(
                                    hashCrc64ecma,
                                    contentMd5,
                                    function(err) {
                                      console.log('check error:', err);

                                      if (err) {
                                        that._changeStatus('failed', err);
                                      } else {
                                        that.update();
                                      }
                                    }
                                );
                              });
                              return;
                            }

                            current += r.value.length;
                            that.progress =
                                Math.round((current * 10000) / that.total) / 100;
                            that._changeProgress(that.progress);

                            if (ws.write(Buffer.from(r.value)) === false) {
                              ws.once('drain', pump);
                              return;
                            }
                            pump();
                          })
                          .catch(function(err) {
                            that._changeStatus('failed', err);
                          });
                    }

                    pump();
                  })
                  .catch(function(err) {
                    console.log(err);
                    that._changeStatus('failed', err);
                  });
            })
            .catch(function(err) {
              console.log(err);
              that._changeStatus('failed', err);
            });
      };
      this.onProgressChange = function(fn) {
        _progressChangeFn = fn;
      };
      this.onStatusChange = function(fn) {
        _statusChangeFn = fn;
      };
      this._changeStatus = function(status, err) {
        // console.log(status, err)
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

            var jobs = [];

            // var fileName = NAME + '-' + __plat.platform + '-' + __plat.arch + '.zip';

            var pkgLink =
              linkPre +
              '/' +
              __plat.platform +
              '-' +
              __plat.arch +
              '/' +
              data.file;

            upgradeOpt.fileName = fileName;
            upgradeOpt.link = linkPre + '/' + fileName;
            upgradeOpt.upgradeJob.status = 'waiting';
            upgradeOpt.upgradeJob.progress = 0;
            upgradeOpt.upgradeJob.pkgLink = pkgLink;

            var jobsFinishedCount = 0;

            var to = path.join(__dirname, '..', lastVersion + '-' + data.file);

            job = new FlatDownloadJob(data.file, pkgLink, to);

            job.onStatusChange(function(status) {
              upgradeOpt.upgradeJob.status = status;
            });
            job.onProgressChange(function(progress) {
              upgradeOpt.upgradeJob.progress = progress;
            });
            job.precheck();

            // 增量更新
            fn(upgradeOpt);

            return;
          }

          // 全量更新
          // var fileName = NAME + '-' + __plat.platform + '-' + __plat.arch + '.zip';
          // var link = data['package_url'].replace(/(\/*$)/g, '') + '/' + lastVersion + '/' + fileName;

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
