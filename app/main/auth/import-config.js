angular.module('web').controller('importConfigCtrl', [
  '$scope',
  '$uibModalInstance',
  '$translate',
  'Toast',
  'onImport',
  function($scope, $modalInstance, $translate, Toast, onImport) {
    var T = $translate.instant;

    angular.extend($scope, {
      text: '',
      parsed: null,
      parseError: '',
      parseType: '',
      showSecret: false,
      cancel: cancel,
      doParse: doParse,
      doImport: doImport,
      fieldLabel: fieldLabel
    });

    // 自动读取剪贴板内容
    try {
      var clip = require('electron').clipboard.readText();

      if (clip && clip.trim()) { $scope.text = clip; }
    } catch (e) {
      // 忽略剪贴板读取失败
    }

    if ($scope.text) { doParse(); }

    function doParse() {
      var result = ImportConfigParser.parse($scope.text || '');

      $scope.parseType = result.type || '';
      $scope.parsed = result.data || null;
      $scope.parseError = result.error
          ? T('auth.importConfig.error.invalid')
          : '';
    }

    function doImport() {
      if (!$scope.parsed) { return; }

      onImport(angular.copy($scope.parsed));
      Toast.success(T('auth.importConfig.success'));
      $modalInstance.dismiss('close');
    }

    function cancel() {
      $modalInstance.dismiss('close');
    }

    function fieldLabel(key) {
      return ImportConfigParser.FIELD_LABELS[key] || key;
    }
  }
]);