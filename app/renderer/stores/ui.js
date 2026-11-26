import { defineStore } from 'pinia';

export const MAX_DEPTH = 2;

// 序号化 dialog name：原版 $uibModal 允许并发对话框（同名业务弹窗仍限制不重复压栈）
let dialogSeq = 0;

// 兼容两种调用形态：Dialog.confirm(title, message, {cls}) 与 （B3 起使用）对象式
// {title,message,okText,cancelText,cls}；对象式此前会落到 title=[object Object]（缺陷修复）。
function normalizeDialogArgs(titleOrOptions, message, options) {
  if (titleOrOptions && typeof titleOrOptions === 'object') {
    const o = titleOrOptions;
    return {
      title: o.title || '',
      message: o.message || '',
      cls: o.cls || 'primary',
      okText: o.okText || '',
      cancelText: o.cancelText || '',
    };
  }
  const opts = options || {};
  return {
    title: titleOrOptions,
    message: message,
    cls: opts.cls || 'primary',
    okText: opts.okText || '',
    cancelText: opts.cancelText || '',
  };
}

let systemThemeMq = null;

// themeMode: 'dark' | 'light' | 'system'；system 跟随 prefers-color-scheme
export function resolveThemeMode(mode) {
  if (mode === 'system') {
    const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
    const dark = supported ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
    return dark ? 'dark' : 'light';
  }
  return mode === 'light' ? 'light' : 'dark';
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    stack: [],
    // B4-05：升级链路状态（顶栏角标/关于页共享）
    theme: 'dark',
    themeMode: 'dark',
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
    setTheme(theme) {
      const nextMode = theme === 'light' || theme === 'system' ? theme : 'dark';
      this.themeMode = nextMode;
      this.theme = resolveThemeMode(nextMode);
      try {
        localStorage.setItem('vsc-theme', nextMode);
        if (typeof document !== 'undefined') document.documentElement.dataset.theme = this.theme;
      } catch (err) {}
      this.watchSystemTheme();
    },
    watchSystemTheme() {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || systemThemeMq) return;
      systemThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        if (this.themeMode !== 'system') return;
        this.theme = resolveThemeMode('system');
        try {
          document.documentElement.dataset.theme = this.theme;
        } catch (err) {}
      };
      if (systemThemeMq.addEventListener) systemThemeMq.addEventListener('change', handler);
      else if (systemThemeMq.addListener) systemThemeMq.addListener(handler);
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
    confirm(titleOrOptions, message, options) {
      const d = normalizeDialogArgs(titleOrOptions, message, options);
      dialogSeq += 1;
      return this.open('dialog-' + dialogSeq, {
        kind: 'confirm',
        title: d.title,
        message: d.message,
        cls: d.cls,
        okText: d.okText,
        cancelText: d.cancelText,
      });
    },
    // 提示框：等价 Dialog.alert —— 仅确定按钮；× / Esc / 遮罩关闭同样 resolve false
    alert(titleOrOptions, message, options) {
      const d = normalizeDialogArgs(titleOrOptions, message, options);
      dialogSeq += 1;
      return this.open('dialog-' + dialogSeq, {
        kind: 'alert',
        title: d.title,
        message: d.message,
        cls: d.cls,
        okText: d.okText,
      });
    },
  },
});