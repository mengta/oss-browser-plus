import { defineStore } from 'pinia';

let seq = 0;

function clipboardWrite(text) {
  if (typeof window === 'undefined' || !window.ossBrowser || !window.ossBrowser.system) {
    return Promise.resolve({ ok: false, code: 'UNAVAILABLE', message: 'clipboard unavailable' });
  }
  return window.ossBrowser.system.clipboardWriteText(String(text || ''));
}

export const useToastStore = defineStore('toast', {
  state: () => ({
    items: [],
  }),
  getters: {
    count: (state) => state.items.length,
  },
  actions: {
    push(message, type, ttl) {
      const text = String(message == null ? '' : message);
      const kind = type || 'danger';
      const key = kind + '|' + text;
      if (this.items.some((item) => item.key === key)) {
        return null;
      }
      const item = {
        id: ++seq,
        key,
        message: text,
        type: kind,
        ttl: typeof ttl === 'number' ? ttl : 3000,
        createdAt: Date.now(),
      };
      this.items.push(item);
      if (item.ttl > 0) {
        setTimeout(() => this.remove(item.id), item.ttl);
      }
      return item.id;
    },
    remove(id) {
      this.items = this.items.filter((item) => item.id !== id);
    },
    clear() {
      this.items = [];
    },
    copy(item) {
      const text = item && typeof item === 'object' ? item.message : item;
      return clipboardWrite(text);
    },
  },
});