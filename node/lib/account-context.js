// P6（R-P6-02/R-P6-04）：账号上下文（AsyncLocalStorage 纯封装）。
// 替代 Angular stub 的 authStore 与主进程 global.localStorage 桩：
// 每次 dispatch 调用注入 ctx（{ auth, requestPayer, privateLink, connectTimeout, settings }），
// 能力服务通过 current()/currentAuth() 读取，避免多账号并发互相污染。
'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function run(ctx, fn) {
  return storage.run(ctx || {}, fn);
}

function current() {
  return storage.getStore() || {};
}

function currentAuth() {
  const ctx = current();
  return ctx.auth || {};
}

// 隔离键：不含 accessKeySecret（不把密钥写入任何可观测标识）
function key() {
  const auth = currentAuth();
  const id = auth.id || auth.accessKeyId || '';
  const region = auth.region || '';
  const endpoint = auth.eptpl || auth.endpoint || '';
  return id + '|' + region + '|' + endpoint;
}

module.exports = { run, current, currentAuth, key };