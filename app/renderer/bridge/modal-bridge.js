import { useUiStore } from '../stores/ui.js';

// BRIDGE-B2（临时桥，B3-19 后删除）：
// Angular 宿主经 window.vueModalHost.open(name, props) 打开已迁移的 Vue 弹窗，
// 返回 Promise<result>（关闭即 resolve，等价 $uibModal 的 close(result)）。
// 同名弹窗已打开时立即 resolve(null)（等价"重复点击不叠加"）。
// 未注册（未迁移）的 name 不得走此桥——调用方保持 $uibModal 原路径。

export function installModalBridge(pinia) {
  if (typeof window === 'undefined') {
    return;
  }
  const ui = useUiStore(pinia);

  window.vueModalHost = {
    open(name, props) {
      const opened = ui.open(name, props || {});
      return opened === null ? Promise.resolve(null) : opened;
    },
    isOpen(name) {
      return ui.isOpen(name);
    },
    close(name, result) {
      return ui.close(name, result);
    },
  };
}