'use strict';

// P6c（T-P6c-01/03）：OSS 服务共享上下文。
// 不再依赖 Angular：$q/$timeout/$state/Toast/Const 均为本地等价实现，
// AuthInfo/localStorage/$rootScope 改为 account-context 的请求级 ctx。
const accountCtx = require('../../../lib/account-context');
const log = require('../../../lib/logger').logger('capabilities.oss');

const ALY = require('../../sdk/aliyun-sdk-adapter');
const AliOSS = require('ali-oss');
const platform = require('platform');

let pkg = { version: '0.0.0' };
try {
  pkg = require('../package.json');
} catch (err) {
  // 源码运行/单测时 services/package.json 可能不存在（仅 dist 复制），回退根 package.json
  try {
    pkg = require('../../../../package.json');
  } catch (err2) {
    pkg = { version: '0.0.0' };
  }
}

const USER_AGENT = `aliyun-sdk-ossbrowser-${platform.os}-${pkg.version}`;

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

// 等价 Angular $q 的最小实现（defer/all/when/reject），行为与原 stub 一致
const $q = {
  defer: function () {
    let resolve;
    let reject;
    const promise = new Promise(function (res, rej) {
      resolve = res;
      reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject, notify: function () {} };
  },
  all: function (promises) {
    return Promise.all(promises);
  },
  when: function (value) {
    return Promise.resolve(value);
  },
  reject: function (reason) {
    return Promise.reject(reason);
  },
};

// 等价 Angular $timeout（fire-and-forget 用法，返回 timer id）
function $timeout(fn, delay) {
  return setTimeout(fn, delay || 0);
}

// P6c 去 Angular：原 q.defer 调用点统一改为本地 defer()
function defer() {
  let resolve;
  let reject;
  const promise = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });
  return { promise: promise, resolve: resolve, reject: reject, notify: function () {} };
}

const $state = { go: function () {} };
const Toast = {
  error: function () {},
  success: function () {},
  info: function () {},
  warning: function () {},
};
const Const = { PRIVATE: 'private', PRIVATE_LINK: 'private-link' };

// 跨模块共享可变状态（原工厂闭包变量）
const state = {
  NEXT_TICK: 1,
  DEF_ADDR: 'oss://',
  stopDeleteFilesFlag: false,
  stopCopyFilesFlag: false,
  keepListFilesJob: null,
};

// 跨模块函数注册表：index.js 在加载各模块后填充，运行期通过 hub.xxx 调用
const hub = {};

function rootScope() {
  const ctx = accountCtx.current();
  if (!ctx.bucketMap) ctx.bucketMap = {};
  if (ctx.internalSupported === undefined) ctx.internalSupported = null;
  return ctx;
}

function currentAuth() {
  return accountCtx.currentAuth();
}

function currentCtx() {
  return accountCtx.current();
}

function connectTimeout() {
  const ctx = accountCtx.current();
  return typeof ctx.connectTimeout === 'number' ? ctx.connectTimeout : 30000;
}

function forEachCompat(obj, fn) {
  Object.keys(obj || {}).forEach(function (key) {
    fn(obj[key], key);
  });
}

module.exports = {
  $q,
  defer,
  $timeout,
  $state,
  Toast,
  Const,
  ALY,
  AliOSS,
  platform,
  pkg,
  USER_AGENT,
  log,
  state,
  hub,
  rootScope,
  currentAuth,
  currentCtx,
  connectTimeout,
  forEachCompat,
  codedError,
};