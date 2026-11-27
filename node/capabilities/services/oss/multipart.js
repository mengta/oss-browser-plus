'use strict';
// 来源：oss2.js:863-950（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { $q, $timeout, state, hub, forEachCompat, defer } = require('./context');
    function listAllUploads(region, bucket) {
      var maxUploads = 100;
      var client = hub.getClient({
        region: region,
        bucket: bucket
      });
      var t = [];
      var df = defer();

      function dig(opt) {
        opt = Object.assign(
            {
              Bucket: bucket,
              Prefix: '',
              MaxUploads: maxUploads
            },
            opt
        );
        client.listMultipartUploads(opt, function(err, result) {
          if (err) {
            df.reject(err);

            return;
          }

          forEachCompat(result.Uploads, function(n) {
            n.initiated = n.Initiated;
            n.name = n.Key;
            n.storageClass = n.StorageClass;
            n.uploadId = n.UploadId;
          });

          t = t.concat(result.Uploads);

          if (result.Uploads.length == maxUploads) {
            $timeout(function() {
              dig({
                KeyMarker: result.NextKeyMarker,
                UploadIdMarker: result.NextUploadIdMarker
              });
            }, state.NEXT_TICK);
          } else {
            df.resolve(t);
          }
        });
      }

      dig({});

      return df.promise;
    }


    function abortAllUploads(region, bucket, uploads) {
      var df = defer();
      var client = hub.getClient({
        region: region,
        bucket: bucket
      });
      var len = uploads.length;
      var c = 0;

      function dig() {
        if (c >= len) {
          df.resolve();

          return;
        }

        client.abortMultipartUpload(
            {
              Bucket: bucket,
              Key: uploads[c].name,
              UploadId: uploads[c].uploadId
            },
            function(err) {
              if (err) { df.reject(err); } else {
                c++;
                $timeout(dig, state.NEXT_TICK);
              }
            }
        );
      }

      dig();

      return df.promise;
    }


module.exports = {
  listAllUploads, abortAllUploads
};
