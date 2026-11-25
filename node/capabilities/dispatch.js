'use strict';

const path = require('path');
const { angularStub } = require('./angular-stub');

const stub = angularStub();

if (!global.angular) global.angular = stub.angular;

const SERVICES_DIR = path.join(__dirname, 'services');


if (!global.localStorage) {
  const store = new Map();
  global.localStorage = {
    getItem: function (key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem: function (key, value) {
      store.set(key, String(value));
    },
    removeItem: function (key) {
      store.delete(key);
    },
    clear: function () {
      store.clear();
    },
  };
}

const transferModule = require('./transfer');
const upgradeModule = require('./upgrade');

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}


const services = {};
let loaded = false;

function record(message) {
  if (!global.__capabilityDiagnostics) global.__capabilityDiagnostics = [];
  global.__capabilityDiagnostics.push(message);
}

function serviceOf(domain) {
  if (!loaded) {
    loaded = true;
    for (const file of ['oss2', 'ram', 'sts']) {
      try {
        require(path.join(SERVICES_DIR, file + '.js'));
      } catch (err) {
        record('load ' + file + ': ' + ((err && err.message) || String(err)));
      }
    }
    for (const pair of [['oss', 'ossSvs2'], ['ram', 'ramSvs'], ['sts', 'stsSvs']]) {
      try {
        services[pair[0]] = stub.resolve(pair[1]);
      } catch (err) {
        record('resolve ' + pair[1] + ': ' + ((err && err.message) || String(err)));
      }
      if (!services[pair[0]]) record('missing service ' + pair[1]);
    }
  }
  return services[domain];
}

function dispatch(domain, method, auth, args) {
  return stub.authStore.run(auth || {}, async function () {
    const callArgs = Array.isArray(args) ? args : [];
    if (domain === 'transfer') {
      const api = transferModule.api;
      if (!api || typeof api[method] !== 'function') {
        throw codedError('UNAVAILABLE', domain + '.' + method + ' is unavailable');
      }
      return await api[method].apply(null, [auth].concat(callArgs));
    }
    if (domain === 'upgrade') {
      // Vue3-B3 前置：升级主进程化，无需 OSS 凭据
      const api = upgradeModule.api;
      if (!api || typeof api[method] !== 'function') {
        throw codedError('UNAVAILABLE', domain + '.' + method + ' is unavailable');
      }
      return await api[method].apply(null, callArgs);
    }
    if (!auth || typeof auth.accessKeyId !== 'string' || !auth.accessKeyId) {
      throw codedError('InvalidAccessKeyId', 'auth.accessKeyId is required');
    }
    if (typeof auth.accessKeySecret !== 'string' || !auth.accessKeySecret) {
      throw codedError('InvalidAccessKeyId', 'auth.accessKeySecret is required');
    }
    const service = serviceOf(domain);
    if (!service || typeof service[method] !== 'function') {
      throw codedError('UNAVAILABLE', domain + '.' + method + ' is unavailable');
    }
    return await service[method].apply(service, callArgs);
  });
}

module.exports = {
  dispatch: dispatch,
  serviceOf: serviceOf,
  setSender: function (webContents) {
    transferModule.setSender(webContents);
    upgradeModule.setSender(webContents);
  },
};