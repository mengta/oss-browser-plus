angular.module('web').factory('Mailer', [
  '$q',
  'settingsSvs',
  'Toast',
  function($q, settingsSvs, Toast) {
    // Vue3-P0-18：邮件发送下沉主进程（nodemailer 不进渲染层）；smtp 配置仍在渲染层读取后随请求传入。
    function bridge() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.mail || null;
    }

    return {
      send: function(info) {
        var api = bridge();
        if (!api || typeof api.send !== 'function') {
          return $q.reject(new Error('mail.send is unavailable'));
        }
        var smtp = settingsSvs.mailSmtp.get();
        return api.send(smtp, info).then(function(res) {
          if (res && res.ok === false) {
            var err = new Error(res.message || res.code);
            err.code = res.code;
            Toast.error((err.code ? err.code + ': ' : '') + (err.message || '发送失败'));
            throw err;
          }
          return res && res.ok === true ? res.data : res;
        }, function(err) {
          Toast.error((err && err.code ? err.code + ': ' : '') + ((err && err.message) || '发送失败'));
          throw err;
        });
      }
    };
  }
]);