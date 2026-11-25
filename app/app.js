angular
    .module('web', [
      'ui.router',
      'ui.bootstrap',
      'ui.codemirror',
      'pascalprecht.translate',
      'ngSanitize',
      'templates',
      'ui.bootstrap.contextMenu'
    ])
    .config([
      '$stateProvider',
      '$urlRouterProvider',
      '$translateProvider',
      function($stateProvider, $urlRouterProvider, $translateProvider) {
        // B2-13：moment.locale('zh-CN') 已移除——日期格式化统一走显式格式串（dayjs），
        // locale 不影响 'YYYY-MM-DD HH:mm:ss' 输出。

        $stateProvider
            .state('files', {
              url: '/',
              templateUrl: 'main/files/files.html',
              controller: 'filesCtrl'
            })
            .state('login', {
// B1-18：Angular 登录模块已停载，登录表单由 Vue 承载（#vue-app）；
// 本 state 仅保留外壳（顶部导航），作为无凭证跳转与登录页容器。
// hideTopNav=1 等价原 loginCtrl：登录页导航只保留品牌/版本与设置/关于。
url: '/login',
template: '<div ng-include="\'main/_/top.html\'" ng-init="hideTopNav=1"></div>'
            });

        $urlRouterProvider.otherwise('/');

        // i18n
        for (var k in Global.i18n) {
          $translateProvider.translations(k, Global.i18n[k].content);
        }

        $translateProvider.preferredLanguage('zh-CN');

        $translateProvider.useSanitizeValueStrategy('escapeParameters');
      }
    ])
    .run([
      '$rootScope',
      '$state',
      '$translate',
      'Toast',
      'SecureStore',
      function($rootScope, $state, $translate, Toast, SecureStore) {
        $rootScope.openURL = function(url) {
          openExternal(url);
        };

        // B1-18：login state 下显示 Vue 登录页（#vue-app），其余 state 保持 Angular 视图。
        $rootScope.$on('$stateChangeSuccess', function() {
          var name = ($state.current && $state.current.name) || '';
          if (document.body) {
            document.body.classList.toggle('vue-mode', name === 'login');
          }
        });

        // CS-02（I-8）：降级/保存失败提示注册
        // （一次性防重复由 SecureStore 内部 session 标记承担，D-7；文案不含敏感字段）
        SecureStore.onDegrade(function() {
          Toast.warn($translate.instant('security.storage.degraded'));
        });
        SecureStore.onSaveError(function() {
          Toast.error($translate.instant('security.storage.savefailed'));
        });

        // //i18n
        var langMap = {};
        var langList = [];

        angular.forEach(Global.i18n, function(v, k) {
          langMap[k] = v;
          langList.push({
            lang: k,
            label: v.label
          });
        });
        var lang = localStorage.getItem('lang') || langList[0].lang;

        $rootScope.langSettings = {
          langList: langList,
          lang: lang,
          changeLanguage: function(key) {
            console.log('changeLanguage:', key);
            key = langMap[key] ? key : langList[0].lang;
            $translate.use(key);
            localStorage.setItem('lang', key);
            $rootScope.langSettings.lang = key;
            Toast.success($translate.instant('setup.success')); // '已经设置成功'
          }
        };
        $translate.use(lang);

        console.log('ready');
      }
    ]);
