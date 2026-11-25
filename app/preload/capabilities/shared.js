'use strict';

const { ipcRenderer } = require('electron');

function invokeChannel(channel, payload, timeoutMs) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    const timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      const err = new Error(channel + ' timed out');
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);
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