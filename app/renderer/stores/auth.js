import { defineStore } from 'pinia';
import {
  AUTH_INFO_KEY,
  AUTH_HIS,
  AUTH_KEEP,
  KEY_AUTHTOKEN,
} from '../services/constants.js';
import * as SecureStore from '../services/secure-store.js';

function getJson(key, defv) {
  const str = SecureStore.get(key, null, { legacyPlain: true });
  if (str) {
    try {
      return JSON.parse(str);
    } catch (err) {
      console.log(err, key);
    }
  }
  return defv || {};
}

function getArray(key) {
  const value = getJson(key, []);
  return Array.isArray(value) ? value : [];
}

function saveJson(key, obj, defv) {
  let source = defv;
  if (obj !== undefined && obj !== null) {
    source = obj;
  } else if (defv === undefined) {
    source = {};
  }
  const payload = Array.isArray(source) ? source.slice() : Object.assign({}, source);
  if (!Array.isArray(payload)) {
    delete payload.httpOptions;
  }
  return SecureStore.set(key, JSON.stringify(payload));
}

function ossApi() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.oss || null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    info: getJson(AUTH_INFO_KEY),
    histories: getJson(AUTH_HIS, []),
    remembered: getJson(AUTH_KEEP),
    authToken: SecureStore.get(KEY_AUTHTOKEN, '', { legacyPlain: true }),
    lastError: null,
    // 仅目录/对象权限账号：ListBuckets 被拒（AccessDenied）时仍允许登录
    listBucketsDenied: false,
  }),
  getters: {
    isLoggedIn: (state) => !!(state.info && state.info.id && state.info.secret),
  },
  actions: {
    load() {
      this.info = getJson(AUTH_INFO_KEY);
      this.histories = getArray(AUTH_HIS);
      this.remembered = getJson(AUTH_KEEP);
      this.authToken = SecureStore.get(KEY_AUTHTOKEN, '', { legacyPlain: true });
      return this.info;
    },
    save(obj) {
      this.info = Object.assign({}, obj);
      saveJson(AUTH_INFO_KEY, this.info);
      return this.info;
    },
    saveToAuthInfo(opt) {
      const next = Object.assign({}, this.info || {});
      for (const key of Object.keys(opt || {})) {
        next[key] = opt[key];
      }
      this.info = next;
      saveJson(AUTH_INFO_KEY, next);
      return next;
    },
    remove() {
      this.info = {};
      SecureStore.remove(AUTH_INFO_KEY);
    },
    remember(obj) {
      this.remembered = Object.assign({}, obj);
      saveJson(AUTH_KEEP, this.remembered);
      return this.remembered;
    },
    unremember() {
      this.remembered = {};
      SecureStore.remove(AUTH_KEEP);
    },
    getRemember() {
      this.remembered = getJson(AUTH_KEEP);
      return this.remembered;
    },
    listHistories() {
      this.histories = getArray(AUTH_HIS);
      return this.histories;
    },
    cleanHistories() {
      this.histories = [];
      SecureStore.remove(AUTH_HIS);
    },
    addHistory(obj) {
      const arr = getArray(AUTH_HIS);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].id === obj.id) {
          arr.splice(i, 1);
          i--;
        }
      }
      arr.unshift(Object.assign({}, obj));
      this.histories = arr;
      saveJson(AUTH_HIS, arr, []);
      return arr;
    },
    removeHistory(id) {
      const arr = getArray(AUTH_HIS);
      const next = arr.filter((item) => item.id !== id);
      this.histories = next;
      saveJson(AUTH_HIS, next, []);
      return next;
    },
    setAuthToken(token) {
      this.authToken = token || '';
      if (this.authToken) {
        SecureStore.set(KEY_AUTHTOKEN, this.authToken);
      } else {
        SecureStore.remove(KEY_AUTHTOKEN);
      }
    },
    async login(credentials, options) {
      const opts = options || {};
      const payload = Object.assign({}, credentials);
      const api = ossApi();
      this.listBucketsDenied = false;
      if (!api || typeof api.listAllBuckets !== 'function') {
        this.lastError = { code: 'UNAVAILABLE', message: 'oss bridge unavailable' };
        throw new Error('oss bridge unavailable');
      }
      let verified = null;
      try {
        verified = await api.listAllBuckets(payload);
      } catch (err) {
        const code = String((err && err.code) || '');
        // proxy 会把 {ok:false} 转为 reject；仅目录/对象权限账号仍允许登录
        if (!/^(AccessDenied|Forbidden)$/i.test(code)) {
          this.lastError = { code: code || 'Error', message: (err && err.message) || code };
          throw err;
        }
        this.listBucketsDenied = true;
      }
      if (verified && verified.ok === false) {
        const code = String(verified.code || '');
        // 仅目录/对象权限账号无法列举 Bucket：不阻断登录，由预设 ossPath 直接访问
        const denied = /^(AccessDenied|Forbidden)$/i.test(code);
        if (!denied) {
          this.lastError = { code: verified.code, message: verified.message };
          const err = new Error(verified.message || verified.code);
          err.code = verified.code;
          throw err;
        }
        this.listBucketsDenied = true;
      }
      this.lastError = null;
      this.save(payload);
      if (opts.remember) {
        this.remember(payload);
        // 等价原 onSubmit：仅勾选"记住秘钥"时写入历史
        this.addHistory(payload);
      }
      return true;
    },
    logout() {
      this.remove();
      this.authToken = '';
      SecureStore.remove(KEY_AUTHTOKEN);
    },
    switchAccount(id) {
      const arr = getArray(AUTH_HIS);
      const target = arr.find((item) => item.id === id);
      if (!target) {
        return null;
      }
      this.save(target);
      return target;
    },
  },
});