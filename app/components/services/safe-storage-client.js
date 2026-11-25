angular.module('web').factory('SafeStorageClient', function() {
  // Vue3-P0-16：safeStorage 原语改经 preload 白名单（同步返回），渲染层不再 require('electron'）。
  // 非 Electron 宿主（单测 Node 进程）无 window.ossBrowser → 恒不可用；
  // 一切 OS/keychain 异常由白名单内部消化并返回 false/null，本层绝不抛出。
  function bridge() {
    if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
    return window.ossBrowser.credentials || null;
  }

  function isAvailable() {
    var api = bridge();
    if (!api) { return false; }
    try {
      var res = api.isAvailable();
      return !!(res && res.ok && res.data === true);
    } catch (e) {
      return false;
    }
  }

  function protect(plainB64) {
    var api = bridge();
    if (!api) { return null; }
    try {
      var res = api.protect(plainB64);
      return res && res.ok ? res.data : null;
    } catch (e) {
      return null;
    }
  }

  function release(protectedB64) {
    var api = bridge();
    if (!api) { return null; }
    try {
      var res = api.release(protectedB64);
      return res && res.ok ? res.data : null;
    } catch (e) {
      return null;
    }
  }

  return {
    isAvailable: isAvailable,
    protect: protect,
    release: release
  };
});