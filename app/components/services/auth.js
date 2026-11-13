angular.module('web').factory('Auth', [
  '$q',
  '$rootScope',
  '$location',
  '$translate',
  'ossSvs2',
  'AuthInfo',
  function($q, $rootScope, $location, $translate, ossSvs2, AuthInfo) {
    var T = $translate.instant;

    return {
      login: login,
      logout: logout
    };

    function login(data) {
      // 例如 'oss://' 这种没有 bucket 的预设路径，按未设置处理
      if (data.osspath && !ossSvs2.parseOSSPath(data.osspath).bucket) {
        data.osspath = '';
      }

      if (!data.osspath) { delete data.region; }

      var df = $q.defer();

      data.httpOptions = {
        timeout: 15000
      };

      if (data.id.indexOf('STS.') != 0) {
        delete data.stoken;
      }

      $rootScope.internalSupported = data.eptpl
        ? data.eptpl.indexOf('-internal') != -1
        : false;

      if (data.osspath) {
        loginWithOssPath(data, df);
      } else {
        loginWithBuckets(data, df);
      }

      return df.promise;
    }

    // 预设路径登录：
    // 1. 先按目录探测（ListObjectsV2），能列到内容说明是目录；
    // 2. 目录探测失败或为空时，再按对象探测（HeadObject，只需要 GetObject 权限），
    //    以支持 STS 只授权单个对象的情况。
    function loginWithOssPath(data, df) {
      var info = ossSvs2.parseOSSPath(data.osspath);
      var key = info.key || '';
      var isDirPath = !key || key.endsWith('/');
      var dirKey = isDirPath ? key : key + '/';

      data.bucket = info.bucket;

      ossSvs2
          .getClient2(data)
          .listV2({
            prefix: dirKey,
            'max-keys': 1,
            delimiter: '/'
          })
          .then(
              function(result) {
                if (hasListResult(result)) {
                  // 目录，规范化后补上结尾的 '/'
                  data.osspath = buildOssPath(info.bucket, dirKey);
                  AuthInfo.save(data);
                  df.resolve();
                } else if (isDirPath) {
                  df.reject({
                    code: 'Error',
                    message: T('login.endpoint.error')
                  }); // '请确定Endpoint是否正确'
                } else {
                  loginWithObject(data, info.bucket, key, df);
                }
              },
              function(err) {
                if (isDirPath) {
                  df.reject(err);
                } else {
                  loginWithObject(data, info.bucket, key, df);
                }
              }
          );
    }

    function loginWithObject(data, bucket, key, df) {
      ossSvs2
          .getClient2(data)
          .head(key)
          .then(function() {
            // 对象路径保持原样，不加结尾的 '/'
            data.osspath = buildOssPath(bucket, key);
            AuthInfo.save(data);
            df.resolve();
          })['catch'](function(err) {
            // 对象不存在时，沿用原来的 Endpoint 错误提示
            if (err && (err.code === 'NoSuchKey' || err.status === 404)) {
              df.reject({
                code: 'Error',
                message: T('login.endpoint.error')
              });
            } else {
              df.reject(err);
            }
          });
    }

    function buildOssPath(bucket, key) {
      return 'oss://' + bucket + '/' + (key || '');
    }

    function hasListResult(result) {
      if (!result) { return false; }

      if (result.objects && result.objects.length > 0) { return true; }
      if (result.prefixes && result.prefixes.length > 0) { return true; }

      // keyCount 在不同版本的 SDK 中可能是 number，也可能是 string
      return Number(result.keyCount) > 0;
    }

    function loginWithBuckets(data, df) {
      ossSvs2.getClient(data).listBuckets(function(err, result) {
        if (err) {
          if (err.code == 'AccessDeniedError') {
            // 登录成功
            AuthInfo.save(data);
            df.resolve();
          } else {
            // 失败
            df.reject(err);
          }
        } else if (result.Buckets) {
          // 登录成功
          AuthInfo.save(data);
          df.resolve();
        } else {
          df.reject({
            code: 'Error', message: T('login.endpoint.error')
          });
        }
      });
    }

    function logout() {
      $rootScope.bucketMap = {};
      var df = $q.defer();

      AuthInfo.remove();
      localStorage.removeItem("private-link");

      df.resolve();

      return df.promise;
    }
  }
]);
