angular.module('web').controller('topCtrl', [
  '$scope',
  '$rootScope',
  '$uibModal',
  '$location',
  '$translate',
  '$timeout',
  'Dialog',
  'Auth',
  'Const',
  'AuthInfo',
  'settingsSvs',
  'autoUpgradeSvs',
  'safeApply',
  function(
      $scope,
      $rootScope,
      $modal,
      $location,
      $translate,
      $timeout,
      Dialog,
      Auth,
      Const,
      AuthInfo,
      settingsSvs,
      autoUpgradeSvs,
      safeApply
  ) {
    var T = $translate.instant;

    angular.extend($scope, {
      logout: logout,
      showFavList: showFavList,
      showAbout: showAbout,
      showReleaseNote: showReleaseNote,
      click10: click10
    });

    var ctime = 0;
    var tid;

    function click10() {
      ctime++;

      if (ctime > 10) {
        console.log('---open dev tool---');
        openDevTools();
      }

      $timeout.cancel(tid);
      tid = $timeout(function() {
        ctime = 0;
      }, 600);
    }

    $rootScope.app = {};
    angular.extend($rootScope.app, Global.app);

    // $scope.aid = AuthInfo.get().id;
    $scope.authInfo = AuthInfo.get();
    $scope.authInfo.expirationStr = dayjs(
        new Date($scope.authInfo.expiration)
    ).format('YYYY-MM-DD HH:mm:ss');

    $scope.$watch('upgradeInfo.isLastVersion', function(v) {
      if (v === false) {
        if (settingsSvs.autoUpgrade.get() == 1) { autoUpgradeSvs.start(); } else { $scope.showAbout(); }

        if (!$scope.upgradeInfo.files) {
          $scope.showAbout();
        }
      }
    });
    $scope.$watch('upgradeInfo.upgradeJob.status', function(s) {
      if (s == 'failed' || s == 'finished') {
        $scope.showAbout();
      }
    });

    // BRIDGE-B2：设置页已迁移 Vue（B3-19 后桥删除）
    $rootScope.showSettings = function(fn) {
      window.vueModalHost.open('settings').then(function() {
        if (typeof fn === 'function') { fn(); }
      });
    };

    function logout() {
      var title = T('logout');
      var message = T('logout.message');

      Dialog.confirm(
          title,
          message,
          function(b) {
            if (b) {
              Auth.logout().then(function() {
                $location.url('/login');
              });
            }
          },
          1
      );
    }

    function showReleaseNote() {
      var converter = new showdown.Converter();
      var version = Global.app.version;
      var lang = autoUpgradeSvs.compareVersion(version, '1.5.1') <= 0 ? '' : $scope.langSettings.lang;

      window.ossBrowser.system.readReleaseNotes(version, lang || '').then(function(res) {
        if (!res || !res.ok || !res.data || !res.data.found) {
          console.error('release notes not found: ' + version);
          return;
        }

        var html = converter.makeHtml(res.data.markdown);
        var message = T('main.upgration'); // '主要更新'

        Dialog.alert(message, html, function() {}, { size: 'lg' });
      });
    }

    // BRIDGE-B2：书签/关于已迁移 Vue（B3-19 后桥删除）
    function showFavList() {
      window.vueModalHost.open('fav-list');
    }

    function showAbout() {
      window.vueModalHost.open('about');
    }

    // Vue 弹窗 → Angular 广播转发器（收藏跳转 goToOssAddress）
    window.vueModalAngularHost = {
      broadcast: function(event, data) {
        $rootScope.$broadcast(event, data);
      }
    };
  }
]);
