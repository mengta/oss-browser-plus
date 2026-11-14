angular
    .module('web')
    .factory('Dialog', [
      '$uibModal',
      function($modal) {
        // remote 模块已于 Electron 14 起移除（D8）：改经 ipcRenderer.invoke 走主进程 dialog
        var { ipcRenderer } = require('electron');

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

          ipcRenderer
              .invoke('dialog:show-open-dialog', {
                title: 'Upload',
                properties: isMac
                    ? ['openFile', 'openDirectory', 'multiSelections']
                    : selopt
              })
              .then(function(r) {
                if (typeof fn === 'function') { fn(r.filePaths); }
              });
        }
        function showDownloadDialog(fn) {
          ipcRenderer
              .invoke('dialog:show-open-dialog', {
                title: 'Download',
                properties: ['openDirectory']
              })
              .then(function(r) {
                if (typeof fn === 'function') { fn(r.filePaths); }
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
