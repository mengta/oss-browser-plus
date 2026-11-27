'use strict';
// 来源：oss2.js:1014-1135（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { $q, hub, defer } = require('./context');
    function getBucketACL(region, bucket) {
      var df = defer();
      var client = hub.getClient({
        region: region,
        bucket: bucket
      });

      client.getBucketAcl(
          {
            Bucket: bucket
          },
          function(err, data) {
            if (err) {
              hub.handleError(err);
              df.reject(err);
            } else {
              if (data.Grants && data.Grants.length == 1) {
                var t = [];

                for (var k in data.Grants[0]) {
                  t.push(data.Grants[0][k]);
                }

                data.acl = t.join('');
              } else {
                data.acl = 'default';
              }

              df.resolve(data);
            }
          }
      );

      return df.promise;
    }


    function updateBucketACL(region, bucket, acl) {
      var df = defer();
      var client = hub.getClient({
        region: region,
        bucket: bucket
      });

      client.putBucketAcl(
          {
            Bucket: bucket,
            ACL: acl
          },
          function(err, data) {
            if (err) {
              hub.handleError(err);
              df.reject(err);
            } else {
              df.resolve(data);
            }
          }
      );

      return df.promise;
    }


    function getACL(region, bucket, key) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });

        client.getObjectAcl(
            {
              Bucket: bucket,
              Key: key
            },
            function(err, data) {
              if (err) {
                hub.handleError(err);
                b(err);
              } else {
                if (data.Grants && data.Grants.length == 1) {
                  var t = [];

                  for (var k in data.Grants[0]) {
                    t.push(data.Grants[0][k]);
                  }

                  data.acl = t.join('');
                } else {
                  data.acl = 'default';
                }

                a(data);
              }
            }
        );
      });
    }


    function updateACL(region, bucket, key, acl) {
      return new Promise(function(a, b) {
        var client = hub.getClient({
          region: region,
          bucket: bucket
        });

        client.putObjectAcl(
            {
              Bucket: bucket,
              Key: key,
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
      });
    }


module.exports = {
  getBucketACL, updateBucketACL, getACL, updateACL
};
