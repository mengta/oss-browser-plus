angular.module('web').controller('akHistoriesCtrl', [
  '$scope',
  '$uibModalInstance',
  '$translate',
  'AuthInfo',
  'Dialog',
  'Toast',
  'onUse',
  function($scope, $modalInstance, $translate, AuthInfo, Dialog, Toast, onUse) {
    var T = $translate.instant;

    angular.extend($scope, {
      his: [],
      keyword: '',
      showSecrets: {},
      cancel: cancel,
      use: use,
      regionText: regionText,
      toggleSecret: toggleSecret,
      remove: remove,
      cleanAll: cleanAll
    });

    listHistories();

    function listHistories() {
      var his = AuthInfo.listHistories();

      $scope.his = angular.isArray(his) ? his : [];
    }

    function cancel() {
      $modalInstance.dismiss('close');
    }

    function use(h) {
      onUse(h);
      $modalInstance.dismiss('close');
    }

    function toggleSecret(h) {
      $scope.showSecrets[h.id] = !$scope.showSecrets[h.id];
    }

    function regionText(h) {
      if (!h.region) { return '-'; }

      var key = 'region.' + h.region;
      var text = T(key);

      return text === key ? h.region : text;
    }

    function remove(h) {
      Dialog.confirm(
          T('auth.removeAK.title'),
          T('auth.removeAK.message', { id: h.id }),
          function(b) {
            if (!b) { return; }

            AuthInfo.removeFromHistories(h.id);
            listHistories();
          },
          1
      );
    }

    function cleanAll() {
      Dialog.confirm(
          T('auth.clearAKHistories.title'),
          T('auth.clearAKHistories.message'),
          function(b) {
            if (!b) { return; }

            AuthInfo.cleanHistories();
            listHistories();
            Toast.success(T('auth.clearAKHistories.successMessage'));
          },
          1
      );
    }
  }
]);