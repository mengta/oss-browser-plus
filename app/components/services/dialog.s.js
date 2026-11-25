angular
    .module('web')
    .factory('Dialog', [
      '$uibModal',
      function($modal) {
        // Vue3-P0-19：对话框经 system.showOpenDialog 白名单（renderer 不再 require electron）

        return {
          alert: alert,
          confirm: confirm,

          showUploadDialog: showUploadDialog,
          showDownloadDialog: showDownloadDialog
        };

        function showUploadDialog(fn, isFolder) {
          var isMac = navigator.userAgent.indexOf('Macintosh') != -1;
          var selopt = isFolder
              ? ['openDirectory', 'multiSelections']
              : ['openFile', 'multiSelections'];

          window.ossBrowser.system
              .showOpenDialog({
                title: 'Upload',
                properties: isMac
                    ? ['openFile', 'openDirectory', 'multiSelections']
                    : selopt
              })
              .then(function(res) {
                if (typeof fn === 'function' && res && res.ok) { fn(res.data.filePaths); }
              });
        }
        function showDownloadDialog(fn) {
          window.ossBrowser.system
              .showOpenDialog({
                title: 'Download',
                properties: ['openDirectory']
              })
              .then(function(res) {
                if (typeof fn === 'function' && res && res.ok) { fn(res.data.filePaths); }
              });
        }

        /**
       *
       * @param title
       * @param msg
       * @param fn
       * @param opt
       *    opt.cls: danger success warning info,
       *    opt.hideIcon:     default: false
       */
        function alert(title, msg, fn, opt) {
          opt = opt || { cls: 'primary' };

          if (typeof opt === 'number') {
            switch (opt) {
              case 2:
                opt = { cls: 'warning' };

                break;
              case 1:
                opt = { cls: 'danger' };

                break;
              default:
                opt = { cls: 'primary' };

                break;
            }
          } else {
            opt = Object.assign({ cls: 'primary' }, opt);
          }

          var putData = {
            title: title,
            message: msg,
            opt: opt,
            callback: fn || function(flag) {}
          };

          $modal.open({
            templateUrl: 'components/services/dialog.html',
            controller: 'alertDialogCtrl',
            size: opt.size || 'md',
            resolve: {
              putData: function() {
                return putData;
              }
            }
          });
        }

        function confirm(title, msg, fn, opt) {
          opt = opt || { cls: 'primary' };

          if (typeof opt === 'number') {
            switch (opt) {
              case 2:
                opt = { cls: 'warning' };

                break;
              case 1:
                opt = { cls: 'danger' };

                break;
              default:
                opt = { cls: 'primary' };

                break;
            }
          } else {
            opt = Object.assign({ cls: 'primary' }, opt);
          }

          var putData = {
            title: title,
            message: msg,
            opt: opt,
            callback: fn || function(flag) {}
          };

          $modal.open({
            templateUrl: 'components/services/dialog.html',
            controller: 'confirmDialogCtrl',
            size: opt.size || 'md',
            resolve: {
              putData: function() {
                return putData;
              }
            }
          });
        }
      }
    ])

    .controller('alertDialogCtrl', [
      '$scope',
      '$uibModalInstance',
      'putData',
      function($scope, $modalInstance, putData) {
        angular.extend($scope, putData);
        $scope.isAlert = true;
        $scope.cancel = function() {
          $modalInstance.dismiss('cancel');
          putData.callback(false);
        };
        $scope.ok = function() {
          $modalInstance.dismiss('cancel');
          putData.callback(true);
        };
      }
    ])

    .controller('confirmDialogCtrl', [
      '$scope',
      '$uibModalInstance',
      'putData',
      function($scope, $modalInstance, putData) {
        angular.extend($scope, putData);
        $scope.cancel = function() {
          $modalInstance.dismiss('cancel');
          putData.callback(false);
        };
        $scope.ok = function() {
          $modalInstance.dismiss('cancel');
          putData.callback(true);
        };
      }
    ]);

// BRIDGE-B2（B2-16）：diff 弹窗工厂自 diff-modal.js 并入（diff-modal.* 已删除，
// B3-19 随本文件一并收口删除）。diff 弹窗本体已迁移 Vue，经临时桥打开。
angular
    .module('web')
    .factory('DiffModal', [
      '$uibModal',
      function($modal) {
        return {
          /**
           * @param title
           * @param originalContent
           * @param content
           * @param callback
           * @param editable
           */
          show: function(title, originalContent, content, callback, editable) {
            editable = editable !== false;

            // BRIDGE-B2：diff 弹窗已迁移 Vue，经临时桥打开（B3-19 后删除桥）。
            // 结果语义与原 $uibModal 版一致：editable 时确定回调 getValue，取消不回调。
            window.vueModalHost.open('diff', {
              title: title || 'Diff',
              editable: editable,
              originalContent: originalContent,
              content: content
            }).then(function(v) {
              if (editable && v != null) { callback(v); }
            });
          }
        };
      }
    ]);
