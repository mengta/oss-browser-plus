'use strict';

const { ipcRenderer } = require('electron');

function invokeChannel(channel, payload, timeoutMs) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    // Vue3-B3-09：timeoutMs 为 0/undefined 表示不做超时（批量删除/复制耗时不定长，原版无超时）
    const timer = timeoutMs
      ? setTimeout(function () {
          if (settled) return;
          settled = true;
          const err = new Error(channel + ' timed out');
          err.code = 'TIMEOUT';
          reject(err);
        }, timeoutMs)
      : null;
    let pending;
    try {
      pending = ipcRenderer.invoke.apply(ipcRenderer, [channel].concat(payload || []));
    } catch (err) {
      clearTimeout(timer);
      settled = true;
      reject(err);
      return;
    }
    pending.then(
      function (res) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (res && res.ok === false) {
          const err = new Error(res.message || res.code || channel + ' failed');
          err.code = res.code || 'INTERNAL';
          if (res.requestId) err.requestId = res.requestId;
          if (res.ecCode) err.ecCode = res.ecCode;
          if (res.failures) err.failures = res.failures;
          reject(err);
          return;
        }
        resolve(res && res.ok === true ? res.data : res);
      },
      function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function buildDomainApi(domain, timeoutMs) {
  const api = {};
  const entry = require('../api-manifest').domains[domain];
  const methods = (entry && entry.methods) || {};
  Object.keys(methods).forEach(function (name) {
    if (methods[name].expose === false) return;
    api[name] = function (auth) {
      return invokeChannel(
        domain + ':' + name,
        [auth, Array.prototype.slice.call(arguments, 1)],
        timeoutMs
      );
    };
  });
  return api;
}

module.exports = { buildDomainApi, invokeChannel };