'use strict';
// 来源：oss2.js:410-862（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { $q, $timeout, log, state, hub, defer } = require('./context');
    function stopCopyFiles() {
      state.stopCopyFilesFlag = true;
    }

    /**
     * 批量复制或移动文件
     * @param region {string} 要求相同region
     * @param items {array} 需要被复制的文件列表，可能为folder，可能为file
     * @param target {object} {bucket,key} 目标目录路径
     * @param progFn {Function} 进度回调  {current:1, total: 11, errorCount: 0}
     * @param removeAfterCopy {boolean} 移动flag，复制后删除。 默认false
     * @param renameKey {string} 重命名目录的 key。
     */

    function copyFiles(
        region,
        items,
        target,
        progFn,
        removeAfterCopy,
        renameKey
    ) {
      var progress = {
        total: 0,
        current: 0,
        errorCount: 0
      };

      state.stopCopyFilesFlag = false;

      // 入口
      var df = defer();

      digArr(items, target, renameKey, function(terr) {
        df.resolve(terr);
      });

      return df.promise;

      // copy oss file
      function copyOssFile(client, from, to, fn) {
        var toKey = to.key;
        var fromKey = '/' + from.bucket + '/' + encodeURIComponent(from.key);

        log.info(
            removeAfterCopy ? 'move' : 'copy',
            '::',
            from.bucket + '/' + from.key,
            '==>',
            to.bucket + '/' + toKey
        );

        client.copyObject({
          Bucket: to.bucket,
          Key: toKey,
          CopySource: fromKey
        }, function(err) {
          if (err) {
            fn(err);

            return;
          }

          if (removeAfterCopy) {
            var client2 = hub.getClient({
              region: region,
              bucket: from.bucket
            });

            client2.deleteObject(
                {
                  Bucket: from.bucket,
                  Key: from.key
                },
                function(err) {
                  if (err) { fn(err); } else { fn(); }
                }
            );
          } else {
            fn();
          }
        });
      }

      // 打平，一条一条 copy
      function doCopyOssFiles(bucket, pkey, arr, target, fn) {
        var len = arr.length;
        var c = 0;
        var t = [];

        progress.total += len;

        var client = hub.getClient({
          region: region,
          bucket: target.bucket
        });

        function _dig() {
          if (c >= len) {
            $timeout(function() {
              fn(t);
            }, state.NEXT_TICK);

            return;
          }

          if (state.stopCopyFilesFlag) {
            df.resolve([
              {
                item: {},
                error: new Error('User cancelled')
              }
            ]);

            return;
          }

          var item = arr[c];
          var toKey = target.key.replace(/\/$/, '');

          toKey = (toKey ? toKey + '/' : '') + item.path.substring(pkey.length);

          copyOssFile(
              client,
              {
                bucket: bucket,
                key: item.path
              },
              {
                bucket: target.bucket,
                key: toKey
              },
              function(err) {
                if (err) {
                  progress.errorCount++;

                  if (progFn) {
                    try {
                      progFn(progress);
                    } catch (e) {
                    //
                    }
                  }

                  t.push({
                    item: item,
                    error: err
                  });
                }

                progress.current++;

                if (progFn) {
                  try {
                    progFn(progress);
                  } catch (e) {
                  //
                  }
                }

                c++;

                // fix ubuntu
                $timeout(_dig, state.NEXT_TICK);
              }
          );
        }

        _dig();
      }

      function doCopyFolder(source, target, fn) {
        var t = [];
        var client = hub.getClient3({
          region: region,
          bucket: source.bucket
        });

        nextList();

        function nextList(marker) {
          var opt = {
            prefix: source.path
          };

          if (marker) { opt.continuationToken = marker; }

          client
              .listV2(opt)
              .then((result) => {
                if (!result.objects) { return; }

                const newTarget = {
                  key: target.key,
                  bucket: target.bucket
                };
                let objs = result.objects
                    .filter((n) => n.name !== opt.prefix)
                    .map((n) => {
                      return Object.assign({}, n, {
                        isFile: true,
                        itemType: 'file',
                        path: n.name,
                        name: n.name.replace(opt.prefix, '')
                      });
                    });

                if (result.objects && result.objects.length === 1 &&
                result.objects[0].name === opt.prefix && !result.isTruncated
                ) {
                // 如果只有一个空文件夹，需要单独重命名这个空文件夹，不能过滤掉
                  const file = result.objects[0];

                  objs = [Object.assign({}, file, {
                    isFile: true,
                    itemType: 'file',
                    path: file.name,
                    name: ''
                  })];
                }

                doCopyOssFiles(
                    source.bucket,
                    source.path,
                    objs,
                    newTarget,
                    function(terr) {
                      if (state.stopCopyFilesFlag) {
                        df.resolve([
                          {
                            item: {},
                            error: new Error('User cancelled')
                          }
                        ]);

                        return;
                      }

                      if (terr) { t = t.concat(terr); }

                      if (result.nextContinuationToken) {
                        $timeout(function() {
                          nextList(result.nextContinuationToken);
                        }, state.NEXT_TICK);
                      } else if (removeAfterCopy && terr.length == 0) {
                      // 移动全部成功， 删除目录
                        const client1 = hub.getClient({
                          region: region,
                          bucket: source.bucket
                        });

                        client1.deleteObject(
                            {
                              Bucket: source.bucket,
                              Key: source.path
                            },
                            function() {
                              $timeout(function() {
                                fn(t);
                              }, state.NEXT_TICK);
                            }
                        );
                      } else {
                        $timeout(function() {
                          fn(t);
                        }, state.NEXT_TICK);
                      }
                    }
                );
              })
              ['catch']((err) => {
                t.push({
                  item: source,
                  error: err
                });
                $timeout(function() {
                  fn(t);
                }, state.NEXT_TICK);
              });
        }
      }

      function doCopyFile(source, target, fn) {
        var client = hub.getClient({
          region: region,
          bucket: target.bucket
        });

        copyOssFile(
            client,
            {
              bucket: source.bucket,
              key: source.path
            },
            {
              bucket: target.bucket,
              key: target.key
            },
            function(err) {
              if (err) {
                fn(err);
              } else {
                fn();
              }
            }
        );
      }

      function digArr(items, target, renameKey, fn) {
        var len = items.length;
        var c = 0;
        var terr = [];

        progress.total += len;

        if (progFn) {
          try {
            progFn(progress);
          } catch (e) {
          //
          }
        }

        function _() {
          if (c >= len) {
            fn(terr);

            return;
          }

          if (state.stopCopyFilesFlag) {
            df.resolve([
              {
                item: {},
                error: new Error('User cancelled')
              }
            ]);

            return;
          }

          var item = items[c];
          var toKey = renameKey;

          if (!renameKey) {
            toKey = target.key.replace(/\/$/, '');
            toKey = (toKey ? toKey + '/' : '') + items[c].name;
          }

          var newTarget = {
            key: toKey, // target.key.replace(/\/$/,'')+'/'+items[c].name,
            bucket: target.bucket
          };

          c++;

          if (item.isFile) {
            doCopyFile(item, newTarget, function(err) {
              if (err) {
                progress.errorCount++;

                if (progFn) {
                  try {
                    progFn(progress);
                  } catch (e) {
                  //
                  }
                }

                terr.push({
                  item: items[c],
                  error: err
                });
              }

              progress.current++;

              if (progFn) {
                try {
                  progFn(progress);
                } catch (e) {
                //
                }
              }

              $timeout(_, state.NEXT_TICK);
            });
          } else {
            progress.total -= 1;
            doCopyFolder(item, newTarget, function(errs) {
              if (errs) {
                terr = terr.concat(errs);
              }

              if (progFn) {
                try {
                  progFn(progress);
                } catch (e) {
                //
                }
              }

              $timeout(_, state.NEXT_TICK);
            });
          }
        }

        _();
      }
    }

    // 移动文件，重命名文件

    function moveFile(region, bucket, oldKey, newKey, isCopy) {
      var df = defer();
      var client = hub.getClient({
        region: region,
        bucket: bucket
      });

      client.copyObject(
          {
            Bucket: bucket,
            Key: newKey,
            CopySource: '/' + bucket + '/' + encodeURIComponent(oldKey),
            MetadataDirective: 'COPY' // 'REPLACE' 表示覆盖 meta 信息，'COPY' 表示不覆盖，只拷贝,
          },
          function(err) {
            if (err) {
              df.reject(err);
              hub.handleError(err);
            } else if (isCopy) {
              df.resolve();
            } else {
              client.deleteObject(
                  {
                    Bucket: bucket,
                    Key: oldKey
                  },
                  function(err) {
                    if (err) {
                      df.reject(err);
                      hub.handleError(err);
                    } else { df.resolve(); }
                  }
              );
            }
          }
      );

      return df.promise;
    }

    /** ************************************/


module.exports = {
  stopCopyFiles, copyFiles, moveFile
};
