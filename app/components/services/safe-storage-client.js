angular.module('web').factory('SafeStorageClient', function() {
  // SafeStorageClient：Electron safeStorage 渲染层直调封装（credential-security D-1，
  // Electron 45 官方文档标注 safeStorage "Process: Main and Renderer"，nodeIntegration 过渡态下可达）。
  // 非 Electron 宿主（单测 Node 进程）require('electron') 失败 → 恒不可用；
  // 一切 OS/keychain 异常内部 catch 返回 null/false，绝不抛出（spec 4.2.2-1）。
  var safeStorage = null;

  try {
    safeStorage = require('electron').safeStorage || null;
  } catch (e) {
    safeStorage = null;
  }

  function isAvailable() {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function') {
      return false;
    }
    try {
      return safeStorage.isEncryptionAvailable() === true;
    } catch (e) {
      return false;
    }
  }

  function protect(plainB64) {
    if (!safeStorage) {
      return null;
    }
    try {
      return Buffer.from(safeStorage.encryptString(plainB64)).toString('base64');
    } catch (e) {
      return null;
    }
  }

  function release(protectedB64) {
    if (!safeStorage) {
      return null;
    }
    try {
      return safeStorage.decryptString(Buffer.from(protectedB64, 'base64'));
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