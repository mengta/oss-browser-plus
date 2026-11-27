'use strict';
// 来源：oss2.js:1505-2125（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { $timeout, log, state, hub, currentCtx, forEachCompat } = require('./context');
    function listFiles(region, bucket, key, marker) {
      return new Promise(function(resolve, reject) {
        let ready = [];
        let ready_dirs = [];
        let ready_objects = [];

        function get(m) {
          return _listFilesOrigion(region, bucket, key, m).then((result) => {
            const { dirs, objects } = result.data;

            if (dirs.length || objects.length) {
              ready_dirs = ready_dirs.concat(dirs);
              ready_objects = ready_objects.concat(objects);
              ready = ready_dirs.concat(ready_objects);
            }

            return {
              data: ready,
              marker: result.marker,
              truncated: result.truncated,
              maxKeys: result.maxKeys
            };
          });
        }

        get(marker).then(
            function(result) {
              var arr = result.data;

              if (arr && arr.length) {
                $timeout(() => {
                  loadStorageStatus(region, bucket, arr);
                }, state.NEXT_TICK);
              }

              resolve(result);
            },
            function(err) {
              // 只有对象级权限（没有 ListObjects 权限）时，回退为 HeadObject，
              // 让预设路径指向单个文件的场景也能显示出该文件。
              if (!marker && key && !key.endsWith('/')) {
                getSingleFile(region, bucket, key).then(
                    function(item) {
                      resolve({
                        data: [item],
                        marker: null,
                        truncated: false
                      });
                    },
                    function() {
                      reject(err);
                    }
                );
              } else {
                reject(err);
              }
            }
        );
      });
    }


    function _listFilesOrigion(region, bucket, key, marker = '', length) {
      if (!length) {
        const lcount = currentCtx().listObjectNum || null;
        if (lcount) length = parseInt(lcount, 10);
        else length = 500;
      }
      const client = hub.getClient3({
        region,
        bucket
      });
      const options = { prefix: key, delimiter: '/', 'max-keys': length };
      let data = {
        nextContinuationToken: '',
        objects: [],
        prefixes: [],
        keyCount: 0,
        isTruncated: true
      };

      const processData = (resp) => {
        // 部分bucket 会返回 prefiex: ['/']， 需要进行过滤
        const dirs = (resp.prefixes || []).filter((n) => n !== key && n !== '/').map((n) => {
          const arr = n.split('/').filter((k) => !!k);
          const name = arr[arr.length - 1];

          return {
            isFolder: true,
            itemType: 'folder',
            path: n,
            name: name === '/' ? name : name.replace(/\/$/, '')
          };
        });
        //保证oss://10012/1/2/3/oss-browser-develop.zip也能加载成功
        const objects = (resp.objects || [])
            .filter((n) => n.name !== key || (!key.endsWith('/') && n.name === key))
            .map((n) => {
              const arr = n.name.split('/').filter((k) => !!k);
              const name = arr[arr.length - 1];

              return Object.assign(n, {
                isFile: true,
                itemType: 'file',
                path: n.name,
                name: name
              });
            });

        return {
          data: {
            dirs,
            objects
          },
          marker: resp.nextContinuationToken,
          truncated: resp.isTruncated
        };
      };

      return new Promise((resolve, reject) => {
        const list = (token) => {
          client.listV2(Object.assign({}, options, { 'continuation-token': token })).then(res => {
            if (res.objects && res.objects.length) {
              data.objects = data.objects.concat(res.objects);
            }

            if (res.prefixes && res.prefixes.length) {
              data.prefixes = data.prefixes.concat(res.prefixes);
            }

            data.keyCount += res.keyCount;
            data.isTruncated = res.isTruncated;
            data.nextContinuationToken = res.nextContinuationToken;

            if (res.isTruncated && res.nextContinuationToken && data.keyCount < length) {
              options['max-keys'] = length - data.keyCount;
              list(res.nextContinuationToken);
            } else {
              resolve(processData(data));
            }
          })['catch'](reject);
        };

        list(marker);
      });
    }


    function listAllFiles(region, bucket, key, folderOnly) {
      const client = hub.getClient3({ region, bucket });

      let all_dirs = [];
      let all_objects = [];

      function listMore(marker) {
        const options = {
          prefix: key,
          'max-keys': 1000
        };

        if (folderOnly) {
          options.delimiter = '/';
        }

        if (marker) {
          options['next-continuationToken'] = marker;
        }

        return client.listV2(options).then((resp) => {
          const dirs = (resp.prefixes || []).map((n) => {
            return {
              name: n,
              path: n,
              isFolder: true,
              itemType: 'folder'
            };
          });

          all_dirs = all_dirs.concat(dirs);

          if (!folderOnly && resp.objects) {
            const objects = (resp.objects || []).map((n) => {
              return Object.assign(n, {
                isFile: true,
                itemType: 'file',
                path: n.name,
                name: n.name.replace(options.prefix, '')
              });
            });

            all_objects = all_objects.concat(objects);
          }

          if (resp.nextContinuationToken) {
            return listMore(resp.nextContinuationToken);
          }

          return all_dirs.concat(all_objects);
        });
      }

      return listMore();
    }


    function listAllBuckets() {
      return new Promise(function(resolve, reject) {
        var client = hub.getClient();

        var t = [];

        var opt = {};

        _dig();

        function _dig() {
          // opt.MaxKeys=50
          client.listBuckets(opt, function(err, result) {
            // log.debug(opt, err, result)
            if (err) {
              hub.handleError(err);
              reject(err);

              return;
            }

            // bucket
            if (result.Buckets) {
              result.Buckets.forEach(function(n) {
                n.creationDate = n.CreationDate;
                n.region = n.Location;
                n.name = n.Name;
                n.extranetEndpoint = n.ExtranetEndpoint;
                n.intranetEndpoint = n.IntranetEndpoint;
                n.storageClass = n.StorageClass;
                n.lastModified = n.LastModified;

                n.isBucket = true;
                n.itemType = 'bucket';
              });
              t = t.concat(result.Buckets);
            }
            // resolve(t);
            // log.debug(result)

            if (result.NextMarker) {
              opt.Marker = result.NextMarker;
              $timeout(_dig, state.NEXT_TICK);
            } else {
              resolve(t);
            }
          });
        }
      });
    }


    function loadStorageStatus(region, bucket, arr) {
      return new Promise(function(resolve, reject) {
        var len = arr.length;
        var c = 0;

        _dig();

        function _dig() {
          if (c >= len) {
            resolve();

            return;
          }

          var item = arr[c];

          c++;

          if (!item.isFile || item.storageClass != 'Archive') {
            _dig();

            return;
          }

          hub.getMeta(region, bucket, item.path).then(
              function(data) {
                if (data.Restore) {
                  var info = parseRestoreInfo(data.Restore);

                  if (info['ongoing-request'] == 'true') {
                    item.storageStatus = 2; // '归档文件正在恢复中，请耐心等待...';
                  } else {
                    item.expired_time = info['expiry-date'];
                    item.storageStatus = 3; // '归档文件，已恢复，可读截止时间
                  }
                } else {
                  item.storageStatus = 1;
                }

                $timeout(_dig, state.NEXT_TICK);
              }, function(err) {
                _dig();
                reject(err);
              }
          );
        }
      });
    }


    function getSingleFile(region, bucket, key) {
      return hub.getMeta2(region, bucket, key).then(function(meta) {
        const arr = key.split('/').filter((k) => !!k);
        const name = arr[arr.length - 1] || key;

        return {
          name: name,
          path: key,
          url: '',
          lastModified: meta.LastModified || '',
          etag: meta.ETag || '',
          type: meta.ContentType || '',
          size: Number(meta.ContentLength) || 0,
          storageClass: meta.StorageClass || 'Standard',
          isFile: true,
          itemType: 'file'
        };
      });
    }


    function listAllCustomDomains(bucket, options) {
      const client = hub.getClient2({
        bucket: bucket
      });

      client.getCnameList = async function getCnameList(name) {
        const params = {
          method: 'GET',
          bucket: name,
          subres: 'cname',
          timeout: options && options.timeout,
          ctx: options && options.ctx,
          successStatuses: [200]
        };
        const result = await this.request(params);
        const { Cname = [] } = await this.parseXML(result.data);

        if (!Array.isArray(Cname)) {
          return [Cname.Domain];
        }

        return Cname.map((_) => _.Domain);
      };

      return client.getCnameList(bucket);
    }


    function listUsableAccelarateDomains(bucket) {
      const acc_endpoints = [
        'oss-accelerate.aliyuncs.com',
        'oss-accelerate-overseas.aliyuncs.com'
      ];
      const store = hub.getClient3({ bucket });
      const urlutil = require('url');

      store.options.endpoint = urlutil.parse(`https://${acc_endpoints[0]}`);
      store.options.cname = false;

      return store
          .list({
            'max-keys': 1
          })
          .then(() => acc_endpoints)
          ['catch'](() => []);
    }

    function parseRestoreInfo(s) {
      // "ongoing-request="true"
      var arr = s.match(/([\w-]+)="([^"]+)"/g);
      var m = {};

      forEachCompat(arr, function(n) {
        var kv = n.match(/([\w-]+)="([^"]+)"/);

        m[kv[1]] = kv[2];
      });

      return m;
    }


module.exports = {
  listFiles, _listFilesOrigion, listAllFiles, listAllBuckets, loadStorageStatus, getSingleFile, listAllCustomDomains, listUsableAccelarateDomains, parseRestoreInfo
};
