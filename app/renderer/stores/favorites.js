import { defineStore } from 'pinia';
import { api } from '../services/api.js';
import { useAuthStore } from './auth.js';

// 等价 Angular Fav 服务（P0-17 语义保持）：
// storage.favorites 白名单异步 I/O + 内存缓存快照；add 乐观更新后异步落盘；MAX 100。
const MAX = 100;

function username() {
  const auth = useAuthStore();
  return (auth.info && auth.info.id) || '';
}

function persist(items) {
  const live = api && api.storage;
  if (!live || typeof live.writeFavorites !== 'function') {
    return Promise.resolve({ ok: false, code: 'UNAVAILABLE' });
  }
  return live.writeFavorites(username(), JSON.stringify(items));
}

export const useFavoritesStore = defineStore('favorites', {
  state: () => ({
    items: [],
    warmed: false,
  }),
  getters: {
    count: (state) => state.items.length,
  },
  actions: {
    // 启动预热（等价 ensureCache）
    warm() {
      if (this.warmed) {
        return Promise.resolve(this.items);
      }
      this.warmed = true;
      const live = api && api.storage;
      if (!live || typeof live.readFavorites !== 'function') {
        return Promise.resolve(this.items);
      }
      return Promise.resolve()
        .then(() => live.readFavorites(username()))
        .then((res) => {
          if (res && res.ok && typeof res.data === 'string') {
            try {
              this.items = JSON.parse(res.data || '[]');
            } catch (err) {
              this.items = [];
            }
          }
          return this.items;
        })
        .catch(() => this.items);
    },
    list() {
      this.warm();
      return this.items;
    },
    has(addr) {
      return this.items.some((item) => item.url === addr);
    },
    add(addr) {
      let arr = this.items.slice();
      if (arr.length >= MAX) {
        return false;
      }
      arr = arr.filter((item) => item.url !== addr);
      arr.push({ url: addr, time: Date.now() });
      if (arr.length > MAX) {
        arr.splice(MAX, arr.length - MAX);
      }
      this.items = arr;
      persist(arr);
      return true;
    },
    remove(addr) {
      const arr = this.items.filter((item) => item.url !== addr);
      this.items = arr;
      persist(arr);
    },
  },
});