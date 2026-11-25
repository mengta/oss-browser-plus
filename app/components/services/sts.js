angular.module('web').factory('stsSvs', [
  '$q',
  '$state',
  'AuthInfo',
  'Toast',
  function($q, $state, AuthInfo, Toast) {
    // Vue3-P0-18：STS 能力下沉主进程（O-10），渲染层仅保留薄代理；assumeRole 签名与错误展示保持。
    function api() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.sts || null;
    }

    function handleError(err) {
      if (err.code == 'InvalidAccessKeyId') {
        $state.go('login');
      } else {
        if (!err.code) {
          if (err.message && err.message.indexOf('Failed to fetch') != -1) {
            err = { code: 'Error', message: '无法连接' };
          } else { err = { code: 'Error', message: err.message }; }
        } else if (err.message && err.message.indexOf('You are not authorized to do this action') != -1) {
          err = { code: 'Error', message: '没有权限, ' + err.message };
        }

        Toast.error(err.code + ': ' + err.message);
      }
    }

    function assumeRole(roleArn, policyStr, seconds) {
      var bridge = api();
      if (!bridge) {
        return $q.reject(new Error('sts.assumeRole is unavailable'));
      }
      return bridge.assumeRole(AuthInfo.get(), roleArn, policyStr, seconds).then(function(res) {
        if (res && res.ok === false) {
          var err = new Error(res.message || res.code);
          err.code = res.code;
          err.requestId = res.requestId;
          handleError(err);
          throw err;
        }
        return res && res.ok === true ? res.data : res;
      }, function(err) {
        handleError(err);
        throw err;
      });
    }

    return {
      assumeRole: assumeRole
    };
  }
]);