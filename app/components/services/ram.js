angular.module('web').factory('ramSvs', [
  '$q',
  '$state',
  'AuthInfo',
  'Toast',
  function($q, $state, AuthInfo, Toast) {
    // Vue3-P0-18：RAM 能力下沉主进程（O-10），渲染层仅保留薄代理；18 个方法名/参数保持冻结。
    function api() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.ram || null;
    }

    function handleError(err) {
      console.error(err);

      if (err.code == 'InvalidAccessKeyId') {
        $state.go('login');
      } else {
        if (!err.code) {
          if (err.message && err.message.indexOf('Failed to fetch') != -1) {
            err = { code: 'Error', message: '无法连接' };
          } else { err = { code: 'Error', message: err.message }; }
        }
        Toast.error(err.code + ': ' + err.message);
      }
    }

    function proxy(method) {
      return function() {
        var bridge = api();
        if (!bridge || typeof bridge[method] !== 'function') {
          return $q.reject(new Error('ram.' + method + ' is unavailable'));
        }
        var args = [AuthInfo.get()].concat(Array.prototype.slice.call(arguments));
        return bridge[method].apply(null, args).then(function(res) {
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
      };
    }

    return {
      listUsers: proxy('listUsers'),
      listGroups: proxy('listGroups'),
      listRoles: proxy('listRoles'),

      createPolicy: proxy('createPolicy'),
      getPolicy: proxy('getPolicy'),
      attachPolicyToRole: proxy('attachPolicyToRole'),
      attachPolicyToGroup: proxy('attachPolicyToGroup'),
      attachPolicyToUser: proxy('attachPolicyToUser'),
      detachPolicyFromUser: proxy('detachPolicyFromUser'),
      listPoliciesForUser: proxy('listPoliciesForUser'),

      getUser: proxy('getUser'),
      createUser: proxy('createUser'),
      updateUser: proxy('updateUser'),
      deleteUser: proxy('deleteUser'),

      createAccessKey: proxy('createAccessKey'),
      updateAccessKey: proxy('updateAccessKey'),
      deleteAccessKey: proxy('deleteAccessKey'),
      listAccessKeys: proxy('listAccessKeys')
    };
  }
]);