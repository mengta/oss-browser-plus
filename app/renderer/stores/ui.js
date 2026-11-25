import { defineStore } from 'pinia';

export const MAX_DEPTH = 2;

// 序号化 dialog name：原版 $uibModal 允许并发对话框（同名业务弹窗仍限制不重复压栈）
let dialogSeq = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    stack: [],
  }),
  getters: {
    depth: (state) => state.stack.length,
    top: (state) => state.stack[state.stack.length - 1] || null,
  },
  actions: {
    open(name, payload) {
      if (this.stack.some((entry) => entry.name === name)) {
        return null;
      }
      if (this.stack.length >= MAX_DEPTH) {
        return null;
      }
      let resolve;
      const promise = new Promise((r) => {
        resolve = r;
      });
      this.stack.push({ name, payload: payload || null, promise, resolve });
      return promise;
    },
    close(name, result) {
      const index = this.stack.findIndex((entry) => entry.name === name);
      if (index < 0) {
        return false;
      }
      const [entry] = this.stack.splice(index, 1);
      entry.resolve(result);
      return true;
    },
    closeAll(result) {
      while (this.stack.length > 0) {
        const entry = this.stack.pop();
        entry.resolve(result);
      }
    },
    isOpen(name) {
      return this.stack.some((entry) => entry.name === name);
    },
    // 确认框：等价 Dialog.confirm —— 确定 true / 取消(含 Esc/×/遮罩) false
    confirm(title, message, options) {
      dialogSeq += 1;
      const opts = options || {};
      return this.open('dialog-' + dialogSeq, {
        kind: 'confirm',
        title,
        message,
        cls: opts.cls || 'primary',
      });
    },
    // 提示框：等价 Dialog.alert —— 仅确定按钮；× / Esc / 遮罩关闭同样 resolve false
    alert(title, message, options) {
      dialogSeq += 1;
      const opts = options || {};
      return this.open('dialog-' + dialogSeq, {
        kind: 'alert',
        title,
        message,
        cls: opts.cls || 'primary',
      });
    },
  },
});