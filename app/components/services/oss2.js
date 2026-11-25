angular.module('web').factory('ossSvs2', [
  '$rootScope',
  '$state',
  'Toast',
  'AuthInfo',
  function($rootScope, $state, Toast, AuthInfo) {
    // Vue3-P0-18：OSS 能力下沉主进程（design O-10），渲染层仅保留薄代理与纯计算方法。
    // 对外方法名/参数保持冻结；错误展示语义沿用原 handleError（InvalidAccessKeyId 跳登录 + Toast）。
    var DEF_ADDR = 'oss://';

    function api() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.oss || null;
    }

    function handleError(err) {
      if (err && err.code == 'InvalidAccessKeyId') {
        $state.go('login');
        return err;
      }
      if (err) {
        if (!err.code) {
          if (err.message && err.message.indexOf('Failed to fetch') != -1) {
            err = { code: 'Error', message: '无法连接' };
          } else {
            err = { code: 'Error', message: err.message };
          }
        } else if (err.message && err.message.indexOf('You are not authorized to do this action') != -1) {
          err = { code: 'Error', message: '没有权限, ' + err.message };
        }
        Toast.error(err.code + ': ' + err.message);
      }
      return err;
    }

    function unwrap(res) {
      if (res && res.ok === false) {
        var err = new Error(res.message || res.code);
        err.code = res.code;
        if (res.requestId) { err.requestId = res.requestId; }
        if (res.ecCode) { err.ecCode = res.ecCode; }
        throw handleError(err) || err;
      }
      return res && res.ok === true ? res.data : res;
    }

    function proxy(method) {
      return function() {
        var bridge = api();
        if (!bridge || typeof bridge[method] !== 'function') {
          return Promise.reject(new Error('oss.' + method + ' is unavailable'));
        }
        var args = [AuthInfo.get()].concat(Array.prototype.slice.call(arguments));
        return bridge[method].apply(null, args).then(
          function(res) { return unwrap(res); },
          function(err) { throw handleError(err) || err; }
        );
      };
    }

    function unavailable(name) {
      return function() {
        return Promise.reject(new Error('oss.' + name + ' is unavailable'));
      };
    }

    function parseOSSPath(ossPath) {
      if (!ossPath || ossPath.indexOf(DEF_ADDR) == -1 || ossPath == DEF_ADDR) {
        return {};
      }

      var str = ossPath.substring(DEF_ADDR.length);
      var ind = str.indexOf('/');
      var bucket;
      var key;

      if (ind == -1) {
        bucket = str;
        key = '';
      } else {
        bucket = str.substring(0, ind);
        key = str.substring(ind + 1);
      }

      return { bucket: bucket, key: key };
    }

    function parseRestoreInfo(s) {
      var arr = String(s || '').match(/([\w-]+)="([^"]+)"/g) || [];
      var m = {};
      angular.forEach(arr, function(n) {
        var kv = n.match(/([\w-]+)="([^"]+)"/);
        m[kv[1]] = kv[2];
      });
      return m;
    }

    function getOssEndpoint(region, bucket, eptpl) {
      eptpl = eptpl || AuthInfo.get().eptpl || 'http://{region}.aliyuncs.com';

      if (bucket && $rootScope.bucketMap && $rootScope.bucketMap[bucket]) {
        var endpoint =
          $rootScope.bucketMap[bucket][
              $rootScope.internalSupported ? 'intranetEndpoint' : 'extranetEndpoint'
          ];

        if (endpoint) {
          return eptpl.indexOf('https://') == 0 ? 'https://' + endpoint : 'http://' + endpoint;
        }
      }

      return eptpl.replace('{region}', region);
    }

    return {
      createFolder: proxy('createFolder'),
      createBucket: proxy('createBucket'),
      restoreFile: proxy('restoreFile'),
      loadStorageStatus: proxy('loadStorageStatus'),

      getMeta: proxy('getMeta'),
      getFileInfo: proxy('getFileInfo'),
      setMeta: proxy('setMeta'),
      setMeta2: proxy('setMeta2'),

      checkFileExists: proxy('checkFileExists'),
      checkFolderExists: proxy('checkFolderExists'),

      listAllBuckets: proxy('listAllBuckets'),

      listAllFiles: proxy('listAllFiles'),
      listFiles: proxy('listFiles'),
      getContent: proxy('getContent'),
      saveContent: proxy('saveContent'),
      getImageBase64Url: proxy('getImageBase64Url'),
      loadObjectSymlinkMeta: proxy('loadObjectSymlinkMeta'),
      putObjectSymlinkMeta: proxy('putObjectSymlinkMeta'),

      moveFile: proxy('moveFile'),
      copyFiles: proxy('copyFiles'),
      stopCopyFiles: proxy('stopCopyFiles'),

      deleteFiles: proxy('deleteFiles'),
      deleteMultiFiles: proxy('deleteMultiFiles'),
      deleteFolder: proxy('deleteFolder'),
      stopDeleteFiles: proxy('stopDeleteFiles'),

      listAllUploads: proxy('listAllUploads'),
      abortAllUploads: proxy('abortAllUploads'),

      deleteBucket: proxy('deleteBucket'),

      listAllCustomDomains: proxy('listAllCustomDomains'),
      listUsableAccelarateDomains: proxy('listUsableAccelarateDomains'),

      getBucketACL: proxy('getBucketACL'),
      updateBucketACL: proxy('updateBucketACL'),
      getACL: proxy('getACL'),
      updateACL: proxy('updateACL'),

      getClient: unavailable('getClient'),
      parseOSSPath: parseOSSPath,
      getOssEndpoint: getOssEndpoint,
      parseRestoreInfo: parseRestoreInfo,
      signatureUrl: proxy('signatureUrl'),

      getClient2: unavailable('getClient2'),
      getClient3: unavailable('getClient3'),
      signatureUrl2: proxy('signatureUrl2')
    };
  }
]);