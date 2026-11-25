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
