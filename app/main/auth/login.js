angular.module('web').controller('loginCtrl', [
  '$scope',
  '$rootScope',
  '$translate',
  'Auth',
  'AuthInfo',
  '$timeout',
  '$location',
  'Const',
  'Toast',
  '$uibModal',
  function(
      $scope,
      _$rootScope,
      $translate,
      Auth,
      AuthInfo,
      $timeout,
      $location,
      Const,
      Toast,
      $modal
  ) {
    var DEF_EP_TPL = 'http://{region}.aliyuncs.com';

    var KEY_REMEMBER = Const.KEY_REMEMBER;
    var SHOW_REQUEST_PAY = Const.SHOW_REQUEST_PAY;
    var SHOW_SECURE = Const.SHOW_SECURE;
    const KEEP_ME_LOGGED_IN = Const.KEEP_ME_LOGGED_IN;
    var KEY_AUTHTOKEN = 'key-authtoken';
    var regions = angular.copy(Const.regions);

    var T = $translate.instant;

    angular.extend($scope, {
      gtab: parseInt(localStorage.getItem('gtag') || 1),
      flags: {
        remember: 'NO',
        requestpaystatus: 'NO',
        secure: 'YES',
        keepLoggedIn: 'YES'
      },
      item: {
        eptpl: DEF_EP_TPL,
        osspath_isdir: false
      },
      eptplType: 'default',

      hideTopNav: 1,
      reg_osspath: /^oss:\/\//,
      regions: regions,
      onSubmit: onSubmit,
      showHistories: showHistories,
      showImportConfig: showImportConfig,
      useHis: useHis,

      open: open,

      onSubmit2: onSubmit2,
      authTokenChange: authTokenChange,

      eptplChange: eptplChange
    });

    $scope.$watch('gtab', function(v) {
      localStorage.setItem('gtag', v);
    });

    $scope.$watch('item.cname', function(v) {
      console.log('cname: ' + v);

      if (v) {
        $scope.eptplType = 'cname';
      }
    });

    function eptplChange(t) {
      $scope.eptplType = t;

      if (t == 'default') {
        $scope.item.eptpl = DEF_EP_TPL;
        $scope.item.cname = false;
      } else if (t == 'customize') {
        $scope.item.cname = false;
        $scope.item.eptpl = '';
      } else if (t == 'cname') {
        $scope.item.cname = true;
        $scope.item.eptplcname = '';
      } else if (t === "privateLink") {
        $scope.item.privateLink = "";
        $scope.item.eptpl = "";
        $scope.item.cname = false;
      }
    }

    function open(a) {
      openExternal(a);
    }

    var tid;

    function authTokenChange() {
      $timeout.cancel(tid);
      tid = $timeout(function() {
        var authToken = $scope.item.authToken || '';

        localStorage.setItem(KEY_AUTHTOKEN, authToken);

        if (!authToken) {
          $scope.authTokenInfo = null;

          return;
        }

        try {
          var str = Buffer.from(authToken, 'base64').toString();
          var info = JSON.parse(str);

          if (
            info.id &&
            info.secret &&
            info.stoken &&
            info.privilege &&
            info.expiration &&
            info.osspath
          ) {
            // 过期
            try {
              var d = new Date(info.expiration).getTime();

              info.isExpired = d <= new Date().getTime();
            } catch (e) {
              //
            }

            $scope.authTokenInfo = info;

            $scope.authTokenInfo.expirationStr = moment(
                new Date(info.expiration)
            ).format('YYYY-MM-DD HH:mm:ss');
          } else if (info.id && info.secret && !info.id.startsWith('STS.')) {
            // 子用户ak
            $scope.authTokenInfo = info;
          } else if (
            new Date(info.expiration).getTime() < new Date().getTime()
          ) {
            $scope.authTokenInfo = null;
          }
        } catch (e) {
          $scope.authTokenInfo = null;
        }
      }, 600);
    }

    init();

    function init() {
      $scope.flags.remember = localStorage.getItem(KEY_REMEMBER) || 'NO';
      $scope.flags.keepLoggedIn =
        localStorage.getItem(KEEP_ME_LOGGED_IN) || 'YES';
      // requestPay状态
      $scope.flags.requestpaystatus =
        localStorage.getItem(SHOW_REQUEST_PAY) || 'NO';

      // 是否使用https
      $scope.flags.secure = localStorage.getItem(SHOW_SECURE) || 'YES';

      const rememberInfo = AuthInfo.getRemember();

      $scope.eptplType = rememberInfo.eptplType;
      delete rememberInfo.eptplType;
      angular.extend($scope.item, rememberInfo);

      // 临时token
      $scope.item.authToken = localStorage.getItem(KEY_AUTHTOKEN) || '';
      authTokenChange();

      listHistories();

      $scope.$watch('flags.remember', function(v) {
        if (v == 'NO') {
          AuthInfo.unremember();
          localStorage.setItem(KEY_REMEMBER, 'NO');
        }
      });

      $scope.$watch('flags.requestpaystatus', function(v) {
        localStorage.setItem(SHOW_REQUEST_PAY, v);
      });

      $scope.$watch('flags.secure', function(v) {
        localStorage.setItem(SHOW_SECURE, v);

        if ($scope.eptplType === 'default') {
          var secure = v === 'YES';

          $scope.item.eptpl = $scope.item.eptpl.replace(
              /^https?/,
              secure ? 'https' : 'http'
          );
        }
      });

      $scope.$watch('flags.keepLoggedIn', function(v) {
        localStorage.setItem(KEEP_ME_LOGGED_IN, v);
      });
    }

    function showHistories() {
      var modal = $modal.open({
        templateUrl: 'main/auth/ak-histories.html',
        controller: 'akHistoriesCtrl',
        size: 'lg',
        resolve: {
          onUse: function() {
            return useHis;
          }
        }
      });

      modal.result.then(listHistories, listHistories);
    }

    function showImportConfig() {
      $modal.open({
        templateUrl: 'main/auth/import-config.html',
        controller: 'importConfigCtrl',
        size: 'lg',
        resolve: {
          onImport: function() {
            return importConfig;
          }
        }
      });
    }

    function importConfig(cfg) {
      if (cfg.eptpl) {
        eptplChange('customize');
        $scope.item.eptpl = cfg.eptpl;

        delete cfg.eptpl;
      }

      angular.extend($scope.item, cfg);
    }

    function useHis(h) {
      if (h.cname) {
        $scope.eptplType = 'cname';
      }

      angular.extend($scope.item, h);

      $scope.item.desc = h.desc || '';
    }

    function listHistories() {
      var his = AuthInfo.listHistories();

      $scope.his = angular.isArray(his) ? his : [];
    }

    function onSubmit(form1) {
      if (!form1.$valid) { return; }
      localStorage.setItem(KEY_REMEMBER, $scope.flags.remember);
      const isPrivateLink = $scope.eptplType === "privateLink";
      if (isPrivateLink) {
        localStorage.setItem(Const.PRIVATE_LINK, $scope.item.privateLink);
      } else {
        localStorage.removeItem(Const.PRIVATE_LINK);
      }
      // osspath 默认给一个 ''，防止出现 osspath 为 undefined, 导致后续逻辑报错情况
      // 可通过 delete $scope.item.osspath 复现后续错误逻辑
      $scope.item.osspath = $scope.item.osspath || '';

      // 预设路径可能指向目录，也可能指向单个对象（例如只授权了某个文件的 STS）。
      // 此处不再强制补 '/', 由 Auth.login 探测路径类型后统一规范化。

      var data = angular.copy($scope.item);

      delete data.osspath_isdir;
      delete data.requestpaystatus;

      if (!data.requestpaystatus) {
        data.requestpaystatus = localStorage.getItem(SHOW_REQUEST_PAY) || 'NO';
      }

      data.secure = localStorage.getItem(SHOW_SECURE) || 'YES';

      // trim password
      if (data.secret) { data.secret = data.secret.trim(); }

      delete data.authToken;
      delete data.securityToken;

      if (data.id.indexOf('STS.') != 0) {
        delete data.stoken;
      }

      if ($scope.flags.remember == 'YES') {
        AuthInfo.remember(
            Object.assign(data, {
              eptplType: $scope.eptplType
            })
        );
      }

      Toast.info(T('logining'), 1000);

      Auth.login(data).then(
          function() {
            if (!data.region && data.eptpl.indexOf('{region}') === -1) {
              var regExp = /https?:\/\/(\S*)\.aliyuncs\.com/;
              var res = data.eptpl.match(regExp);

              if (res) {
                data.region = res[1].replace('-internal', '');
                AuthInfo.save(data);
              }
            }

            if ($scope.flags.remember == 'YES') { AuthInfo.addToHistories(data); }

            Toast.success(T('login.successfully'), 1000);
            $location.url('/');
          },
          function(err) {
            Toast.error(err.code + ':' + err.message);
          }
      );

      return false;
    }

    // token login
    function onSubmit2(form2) {
      localStorage.removeItem(Const.privateLink);
      if (!form2.$valid) { return; }

      if (!$scope.authTokenInfo) {
        return;
      }

      var data = angular.copy($scope.authTokenInfo);

      Toast.info(T('logining'), 1000); // '正在登录...'

      Auth.login(data).then(
          function() {
            Toast.success(T('login.successfully'), 1000); // '登录成功，正在跳转...'
            $location.url('/');
          },
          function(err) {
            Toast.error(err.code + ':' + err.message);
          }
      );

      return false;
    }
  }
]);
