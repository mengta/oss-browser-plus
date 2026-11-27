'use strict';

// P6c（T-P6c-04/05）：主进程级设置读取，替代 global.localStorage 桩。
// 原渲染层 localStorage 设置无法跨进程传递，主进程桩恒为空；此处保持与原 fallback 一致的默认值。
const DEFAULTS = {
  uploadPartSize: 10,
  downloadConcurrecyPartSize: 5,
  connectTimeout: 60000,
  logFile: 0,
  logFileInfo: 0,
  'show-request-pay': 'NO',
  listObjectNum: 500,
};

const store = new Map();

function get(name, fallback) {
  if (store.has(name)) return store.get(name);
  if (Object.prototype.hasOwnProperty.call(DEFAULTS, name)) return DEFAULTS[name];
  return fallback;
}

function set(name, value) {
  store.set(String(name), value);
}

module.exports = { get, set, DEFAULTS };