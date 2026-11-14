'use strict';

// 浏览器环境替身：localStorage（内存版）与 navigator.language
// 供 AngularJS 源文件（i18n、authinfo、ossstore util 等）在 Node 下加载。

function stubLocalStorage(initial) {
  const store = new Map(Object.entries(initial || {}));
  const storage = {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(String(k), String(v));
    },
    removeItem(k) {
      store.delete(String(k));
    },
    clear() {
      store.clear();
    },
    key(index) {
      const keys = [...store.keys()];
      return index < keys.length ? keys[index] : null;
    },
  };
  Object.defineProperty(storage, 'length', {
    get() {
      return store.size;
    },
  });
  global.localStorage = storage;
  return storage;
}

function stubNavigator(locale) {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: locale },
    configurable: true,
    writable: true,
  });
  return () => {
    if (prev) {
      Object.defineProperty(globalThis, 'navigator', prev);
    } else {
      delete globalThis.navigator;
    }
  };
}

function restoreEnv() {
  delete global.localStorage;
  delete global.navigator;
}

module.exports = { stubLocalStorage, stubNavigator, restoreEnv };