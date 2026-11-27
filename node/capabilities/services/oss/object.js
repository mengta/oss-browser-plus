'use strict';
// 来源：oss2.js:951-1662（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { hub } = require('./context');
    function createFolder(region, bucket, prefix) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });

        client.putObject(
            {
              Bucket: bucket,
              Key: prefix,
              Body: ''
            },
            function(err, data) {
              if (err) {
                hub.handleError(err);
                b(err);
              } else {
                a(data);
              }
            }
        );
      });
    }


    function createBucket(region, bucket, acl, storageClass) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });

        client.createBucket(
            {
              Bucket: bucket,
              CreateBucketConfiguration: {
                StorageClass: storageClass
              }
            },
            function(err) {
              if (err) {
                hub.handleError(err);
                b(err);
              } else {
                client.putBucketAcl(
                    {
                      Bucket: bucket,
                      ACL: acl
                    },
                    function(err, data) {
                      if (err) {
                        hub.handleError(err);
                        b(err);
                      } else {
                        a(data);
                      }
                    }
                );
              }
            }
        );
      });
    }


    function deleteBucket(region, bucket) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });

        client.deleteBucket(
            {
              Bucket: bucket
            },
            function(err, data) {
              if (err) {
                hub.handleError(err);
                b(err);
              } else {
                a(data);
              }
            }
        );
      });
    }


    function getContent(region, bucket, key) {
      return new Promise(function(a, b) {
        const client = hub.getClient3({
          region: region,
          bucket: bucket
        });

        client
            .get(key)
            .then((resp) => {
              a(resp);
            })
            ['catch']((err) => {
              hub.handleError(err);
              b(err);
            });
      });
    }


    function saveContent(region, bucket, key, content, isCodeSave) {
      return new Promise(function(resolve, reject) {
        // aliyun sdk, browser
        const client = hub.getClient({
          region: region,
          bucket: bucket
        });
        // ali-oss, node
        const client3 = hub.getClient3({
          region: region,
          bucket: bucket
        });

        Promise.all([
          new Promise((resolve, reject) => {
            client.headObject({ Bucket: bucket, Key: key }, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          }),
          client3.getACL(key),
          client3.getObjectTagging(key)
        ]).then(([headResult, aclResult, taggingResult])=> {
          let tagging = '';

          if (taggingResult && taggingResult.tag) {
            tagging = Object.keys(taggingResult.tag).map(function(k) {
              // eslint-disable-next-line no-undef
              return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
            }).join('&');
          }

          let encoding = headResult.ContentEncoding;
          // code-modal保存时，如果encoding=gzip，就不变更gzip，避免内容未做gzip压缩，导致sdk中的urllib响应内容解析失败
          if (isCodeSave && encoding === 'gzip') {
            encoding = undefined;
          }

          client3.put(key, new Buffer(content), {
            mime: headResult.ContentType,
            meta: headResult.Metadata,
            headers: {
              'Content-Disposition': headResult.ContentDisposition,
              'Content-Encoding': encoding,
              'Cache-Control': headResult.CacheControl,
              'Content-Language': headResult.ContentLanguage,
              'x-oss-storage-class': headResult.StorageClass,
              'x-oss-object-acl': aclResult.acl,
              'x-oss-tagging': tagging
            }
          }).then(resolve)['catch'](e => {
            hub.handleError(e);
            reject(e);
          });
        })['catch'](e => {
          hub.handleError(e);
          reject(e);
        });

        // client.headObject({ Bucket: bucket, Key: key }, function (err, result) {
        //   if (err) {
        //     hub.handleError(err);
        //     reject(err);
        //   } else {
        // client.putObject({
        //     Bucket: bucket,
        //     Key: key,
        //     Body: content,
        //
        //     //保留http头
        //     ContentLanguage: result.ContentLanguage,
        //     ContentType: result.ContentType,
        //     CacheControl: result.CacheControl,
        //     ContentDisposition: result.ContentDisposition,
        //     ContentEncoding: "",
        //     Expires: result.Expires,
        //     Metadata: result.Metadata,
        //   }, function (err) {
        //     if (err) {
        //       hub.handleError(err);
        //       reject(err);
        //     } else {
        //       resolve();
        //     }
        //   }
        // );
        //   }
        // });
      });
    }


    function getImageBase64Url(region, bucket, key) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });

        client.getObject(
            {
              Bucket: bucket,
              Key: key
            },
            function(err, data) {
              if (err) {
                hub.handleError(err);
                b(err);
              } else {
                a(data);
              }
            }
        );
      });
    }


    function getMeta(region, bucket, key) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });
        var opt = {
          Bucket: bucket,
          Key: key
        };

        client.headObject(opt, function(err, data) {
          if (err) {
            hub.handleError(err);
            b(err);
          } else {
            a(data);
          }
        });
      });
    }


    function getMeta2(region, bucket, key) {
      const client = hub.getClient3({ region, bucket });

      function adapter(obj) {
        const outputStructure = {
          AcceptRanges: {
            name: 'accept-ranges'
          },
          CacheControl: {
            name: 'Cache-Control'
          },
          ContentDisposition: {
            name: 'Content-Disposition'
          },
          ContentEncoding: {
            name: 'Content-Encoding'
          },
          ContentLanguage: {
            name: 'Content-Language'
          },
          ContentLength: {
            type: 'integer',
            name: 'Content-Length'
          },
          ContentType: {
            name: 'Content-Type'
          },
          DeleteMarker: {
            type: 'boolean',
            name: 'x-oss-delete-marker'
          },
          ETag: {
            name: 'ETag'
          },
          Expiration: {
            name: 'x-oss-expiration'
          },
          Expires: {
            type: 'timestamp',
            name: 'Expires'
          },
          LastModified: {
            type: 'timestamp',
            name: 'Last-Modified'
          },
          Restore: {
            name: 'x-oss-restore'
          },
          ServerSideEncryption: {
            name: 'x-oss-server-side-encryption'
          },
          VersionId: {
            name: 'x-oss-version-id'
          },
          WebsiteRedirectLocation: {
            name: 'x-oss-website-redirect-location'
          }
        };
        const output = {
          Metadata: obj.meta
        };
        const { hasOwnProperty } = Object.prototype;
        const headers = obj.res.headers;

        // extract output
        for (let key in outputStructure) {
          if (hasOwnProperty.call(outputStructure, key)) {
            const name = outputStructure[key].name.toLowerCase();

            if (headers[name] !== undefined) {
              output[key] = headers[name];
            }
          }
        }

        // extract x-oss-...
        for (let key in headers) {
          if (key.indexOf('x-oss-') == 0) {
            let arr = key.substring('x-oss-'.length).split('-');

            for (let i = 0; i < arr.length; i++) {
              arr[i] = arr[i][0].toUpperCase() + arr[i].substring(1);
            }

            output[arr.join('')] = headers[key];
          } else if (key === 'content-md5') {
            output.ContentMD5 = headers['content-md5'];
          }
        }

        // extract requestId
        output.RequestId =
          headers['x-oss-request-id'] || headers['x-oss-requestid'];

        return output;
      }

      return client.head(key).then((res) => {
        return adapter(res);
      });
    }


    function setMeta(region, bucket, key, headers, metas) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });
        var opt = {
          Bucket: bucket,
          Key: key,
          CopySource: '/' + bucket + '/' + encodeURIComponent(key),
          MetadataDirective: 'REPLACE', // 覆盖meta

          Metadata: metas || {},

          ContentType: headers.ContentType,
          CacheControl: headers.CacheControl,
          ContentDisposition: headers.ContentDisposition,
          ContentEncoding: headers.ContentEncoding,
          ContentLanguage: headers.ContentLanguage,
          Expires: headers.Expires
        };

        client.copyObject(opt, function(err, data) {
          if (err) {
            hub.handleError(err);
            b(err);
          } else {
            a(data);
          }
        });
      });
    }


    function setMeta2(region, bucket, key, headers, meta) {
      const client = hub.getClient3({ region, bucket });

      return client
          .copy(key, key, {
            headers,
            meta
          })
          ['catch'](hub.handleError);
    }


    function restoreFile(region, bucket, key, days) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });
        var opt = {
          Bucket: bucket,
          Key: key,
          RestoreRequest: {
            Days: days || 7
          }
        };

        client.restoreObject(opt, function(err, data) {
          if (err) {
            hub.handleError(err);
            b(err);
          } else {
            a(data);
          }
        });
      });
    }


    function loadObjectSymlinkMeta(region, bucket, key) {
      const client = hub.getClient3({ region, bucket });

      return new Promise((a, b) => {
        client
            .getSymlink(key)
            .then((data) => a(data))
            ['catch']((e) => {
              hub.handleError(e);
              b(e);
            });
      });
    }


    function putObjectSymlinkMeta(region, bucket, key, targetName) {
      const client = hub.getClient3({ region, bucket });

      return new Promise((a, b) => {
        client
            .putSymlink(key, targetName)
            .then((data) => a(data))
            ['catch']((e) => {
              hub.handleError(e);
              b(e);
            });
      });
    }


module.exports = {
  createFolder, createBucket, deleteBucket, getContent, saveContent, getImageBase64Url, getMeta, getMeta2, setMeta, setMeta2, restoreFile, loadObjectSymlinkMeta, putObjectSymlinkMeta
};
