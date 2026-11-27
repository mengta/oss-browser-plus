'use strict';

const path = require('path');
const accountCtx = require('../lib/account-context');

const SERVICES_DIR = path.join(__dirname, 'services');

// P6c（T-P6c-04）：服务改为 require 直连，删除 angular-stub 与 global.localStorage 桩
const ossService = require(path.join(SERVICES_DIR, 'oss'));
const ramService = require(path.join(SERVICES_DIR, 'ram'));
const stsService = require(path.join(SERVICES_DIR, 'sts'));

const transferModule = require('./transfer');
const upgradeModule = require('./upgrade');

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}


const services = { oss: ossService, ram: ramService, sts: stsService };
let loaded = true;
// Vue3-B3-09：oss 批量删除/复制的进度回传通道（renderer → preload → main 单向 invoke 之外的事件流）
let progressSender = null;

function buildContext(normalized) {
  return {
    auth: normalized,
    requestPayer: normalized.requestpaystatus === 'YES' ? 'requester' : undefined,
    privateLink: normalized.privateLink || normalized.private_link || '',
    connectTimeout: typeof normalized.connectTimeout === 'number' ? normalized.connectTimeout : 30000,
    listObjectNum: normalized.listObjectNum || null,
  };
}

function record(message) {
  if (!global.__capabilityDiagnostics) global.__capabilityDiagnostics = [];
  global.__capabilityDiagnostics.push(message);
}

// Vue3-B3-09：把 oss:progress 进度转成主进程服务可用的回调（函数无法跨 IPC，改由 progressId 关联）
function progressCallback(progressId) {
  return function (progress) {
    if (!progressSender || typeof progressSender.send !== 'function') return;
    try {
      progressSender.send('oss:progress', { progressId: progressId, progress: progress });
    } catch (err) {
      record('send oss:progress: ' + ((err && err.message) || String(err)));
    }
  };
}

// Vue3-B3-09：批量删除原服务以「数组 reject」返回逐项失败明细（{item,error}），
// IPC 无法直接承载 Error 对象，归一化为可序列化的 code+failures，渲染层据此展示失败清单。
function normalizeServiceError(err) {
  if (!Array.isArray(err)) return err;
  const out = new Error('PARTIAL_FAILURE');
  out.code = 'PARTIAL_FAILURE';
  out.failures = err.map(function (entry) {
    const item = (entry && entry.item) || {};
    const error = entry && entry.error;
    return {
      item: {
        path: item.path || '',
        name: item.name || '',
        isFolder: !!item.isFolder,
      },
      message: (error && error.message) || String(error || 'unknown error'),
    };
  });
  return out;
}

function serviceOf(domain) {

  return services[domain];
}

// 渲染层凭证为 Angular auth-info 格式 {id,secret,stoken}；主进程能力域使用 {accessKeyId,accessKeySecret,securityToken}。
// 入口统一归一化（保留原字段，oss2 仍读取 id/secret/requestpaystatus 等）。
function normalizeAuth(auth) {
  const raw = auth && typeof auth === 'object' ? auth : {};
  const accessKeyId = raw.accessKeyId || raw.id || '';
  const accessKeySecret = raw.accessKeySecret || raw.secret || '';
  const securityToken = raw.securityToken || raw.stoken || '';
  return Object.assign({}, raw, {
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
    securityToken: securityToken,
  });
}

function dispatch(domain, method, auth, args) {
  const normalized = normalizeAuth(auth);
  const ctx = buildContext(normalized);
  return accountCtx.run(ctx, async function () {
    const callArgs = Array.isArray(args) ? args : [];
    if (domain === 'transfer') {
      const api = transferModule.api;
      if (!api || typeof api[method] !== 'function') {
        throw codedError('UNAVAILABLE', domain + '.' + method + ' is unavailable');
      }
      // 仅任务创建需要凭证；暂停/恢复/查询等按 taskId 定位，不能再注入 auth 作为首参
      const needsAuth = method === 'createUpload' || method === 'createDownload';
      return await api[method].apply(null, (needsAuth ? [normalized] : []).concat(callArgs));
    }
    if (domain === 'upgrade') {
      // Vue3-B3 前置：升级主进程化，无需 OSS 凭据
      const api = upgradeModule.api;
      if (!api || typeof api[method] !== 'function') {
        throw codedError('UNAVAILABLE', domain + '.' + method + ' is unavailable');
      }
      return await api[method].apply(null, callArgs);
    }
    if (!normalized.accessKeyId || typeof normalized.accessKeyId !== 'string') {
      throw codedError('InvalidAccessKeyId', 'auth.accessKeyId is required');
    }
    if (typeof normalized.accessKeySecret !== 'string' || !normalized.accessKeySecret) {
      throw codedError('InvalidAccessKeyId', 'auth.accessKeySecret is required');
    }
    const service = serviceOf(domain);
    if (!service || typeof service[method] !== 'function') {
      throw codedError('UNAVAILABLE', domain + '.' + method + ' is unavailable');
    }
    // P6a/P6b（R-P6-01）：STS/RAM 已去 Angular 依赖，统一以 ctx 作为首参

    if (domain === 'sts' || domain === 'ram') {
      try {
        return await service[method].apply(service, [ctx].concat(callArgs));
      } catch (err) {
        throw normalizeServiceError(err);
      }
    }
    // Vue3-B3-09：批量删除/复制的进度回调注入（两个服务签名第 4 参均为进度回调）
    if (domain === 'oss' && (method === 'deleteFiles' || method === 'copyFiles')) {
      const tail = callArgs[callArgs.length - 1];
      if (tail && typeof tail === 'object' && typeof tail.progressId === 'string') {
        callArgs.pop();
        callArgs.splice(3, 0, progressCallback(tail.progressId));
      }
    }
    try {
      return await service[method].apply(service, callArgs);
    } catch (err) {
      throw normalizeServiceError(err);
    }
  });
}

module.exports = {
  dispatch: dispatch,
  normalizeAuth: normalizeAuth,
  serviceOf: serviceOf,
  setSender: function (webContents) {
    progressSender = webContents;
    transferModule.setSender(webContents);
    upgradeModule.setSender(webContents);
  },
};