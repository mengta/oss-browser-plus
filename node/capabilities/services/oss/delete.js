'use strict';
// 来源：oss2.js:193-409（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { log, state, hub } = require('./context');
    function stopDeleteFiles() {
      state.stopDeleteFilesFlag = true;
    }

    /**
     * 批量删除文件或目录
     * @param region {string}
     * @param bucket {string}
     * @param items   {array}  item={path,isFolder}
     * @param progCb  {function} 可选， 进度回调  (current,total)
     */

    function deleteFiles(region, bucket, items, progCb) {
      state.stopDeleteFilesFlag = false;

      var client = hub.getClient3({
        region: region,
        bucket: bucket
      });
      const progress = {
        current: 0,
        total: 0,
        errorCount: 0
      };
      const files = [];
      const folders = [];

      items.forEach((item) => {
        if (item.isFile) {
          files.push(item.path);
        } else if (item.isFolder && item.path) {
          folders.push(item.path);
        }
      });
      let p = [];

      if (folders.length) {
        p = p.concat(
            folders.map((folder) => () => deleteFolder({ region, bucket, folder, progCb, progress }))
        );
      }

      if (files.length) {
        p.push(() => deleteMultiFiles({ region, bucket, files, progCb, progress }));
      }

      return Promise.all(
          p.map(
              i => i()
                  .then(value => ({ status: 'fulfilled', value }))
                  ['catch'](reason => ({ status: 'rejected', reason }))
          )
      ).then(v => {
        const fulfilled = [];
        let rejected = [];

        if (v && v.length) {
          v.forEach(i => {
            if (i.status === 'fulfilled') {
              fulfilled.push(i.value);
            } else {
              // eslint-disable-next-line no-unused-expressions
              i.status === 'rejected';

              if (Array.isArray(i.reason)) {
                rejected = rejected.concat(i.reason);
              }

              rejected.push(i.reason);
            }
          });
        }

        if (rejected && rejected.length) {
          throw rejected;
        }

        return fulfilled;
      });
    }

    /**
     * 删除某个文件夹
     * @param region {string}
     * @param bucket {string}
     * @param folder  {string} 目录
     * @param progCb  {function} 可选， 进度回调  (current,total, errorCount)
     */

    function deleteFolder({ region, bucket, folder, marker, progCb, progress }) {
      const client = hub.getClient3({ region: region, bucket: bucket });
      const options = { prefix: folder, 'max-keys': 1000 };

      if (state.stopDeleteFilesFlag) {
        throw {
          item: {
            isFolder: true,
            path: folder
          },
          error: new Error('User cancelled')
        };
      }

      return new Promise((resolve, reject) => {
        let listFinish = false;
        const listDeleteFolder = (token) => {
          if (state.stopDeleteFilesFlag) {
            reject({
              item: {
                isFolder: true,
                path: folder
              },
              error: new Error('User cancelled')
            });

            return;
          }

          return client.listV2(Object.assign({}, options, { 'continuation-token': token }))
              .then(({ objects = [], nextContinuationToken, isTruncated }) => {
                if (state.stopDeleteFilesFlag) {
                  reject({
                    item: {
                      isFolder: true,
                      path: folder
                    },
                    error: new Error('User cancelled')
                  });

                  return;
                }

                const files = objects.map(i => i.name);

                if (files && files.length) {
                  progress.total += files.length;

                  if (progCb) { progCb(progress); }

                  client.deleteMulti(files).then(() => {
                    progress.current += files.length;
                    progCb(progress);

                    if (listFinish && progress.current + progress.errorCount === progress.total) {
                      resolve();
                    }
                  })['catch']((e) => {
                    progress.errorCount += files.length;
                    log.error('删除失败', e);
                  });
                }

                if (nextContinuationToken) {
                  return listDeleteFolder(nextContinuationToken);
                }

                listFinish = true;
                if (progress.total === 0 || progress.current + progress.errorCount >= progress.total) {
                  resolve();
                }

                return '';
              })['catch'](() => {
                reject();
              });
        };

        listDeleteFolder('');
      });
    }
    /**
     * 删除多个文件
     * @param region {string}
     * @param bucket {string}
     * @param files  {string[]} 文件数组
     * @param progCb  {function} 可选， 进度回调  (current,total, errorCount)
     */

    function deleteMultiFiles({ region, bucket, files, progCb, progress }) {
      const client = hub.getClient3({
        region: region,
        bucket: bucket
      });
      const CHUNK_SIZE = 1000;

      return new Promise((resolve, reject) => {
        const chunk = files.reduce((rows, key, index) =>
          (index % CHUNK_SIZE == 0 ? rows.push([key]) : rows[rows.length - 1].push(key)) && rows,
        []);

        chunk.forEach((chunkFiles, index) => {
          progress.total += chunkFiles.length;

          if (state.stopDeleteFilesFlag) {
            reject(chunkFiles.map((i) => {
              return {
                item: {
                  isFile: true,
                  path: i
                },
                error: new Error('User cancelled')
              };
            }));

            return;
          }

          client.deleteMulti(chunkFiles).then(() => {
            progress.current += chunkFiles.length;
            if (progCb) progCb(progress);

            if (index === chunk.length - 1) {
              resolve();
            }
          })['catch']((e) => {
            progress.errorCount += files.length;
            log.error('删除失败', e);
            reject(e);
          });
        });
      });
    }


module.exports = {
  stopDeleteFiles, deleteFiles, deleteFolder, deleteMultiFiles
};
