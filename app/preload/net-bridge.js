'use strict';

const { contextBridge } = require('electron');

const DOMAIN_ORDER = [
  'bootstrap',
  'system',
  'credentials',
  'digest',
  'storage',
  'oss',
  'sts',
  'ram',
  'mail',
  'transfer',
  'upgrade',
];

const MINIMAL_FALLBACK = {
  bootstrap: ['get'],
  system: ['getStaticServerPort', 'openExternal', 'showOpenDialog'],
};

const CAPABILITY_LOADERS = {
  bootstrap: () => require('./capabilities/bootstrap'),
  system: () => require('./capabilities/system'),
  credentials: () => require('./capabilities/credentials'),
  digest: () => require('./capabilities/digest'),
  storage: () => require('./capabilities/storage'),
  oss: () => require('./capabilities/oss'),
  sts: () => require('./capabilities/sts'),
  ram: () => require('./capabilities/ram'),
  mail: () => require('./capabilities/mail'),
  transfer: () => require('./capabilities/transfer'),
  upgrade: () => require('./capabilities/upgrade'),
};

function toError(err) {
  var out = {
    ok: false,
    code: (err && err.code) || 'INTERNAL',
    message: (err && err.message) || String(err),
  };
  if (err && err.requestId) out.requestId = err.requestId;
  if (err && err.ecCode) out.ecCode = err.ecCode;
  if (err && err.hostId) out.hostId = err.hostId;
  if (err && err.statusCode) out.statusCode = err.statusCode;
  return out;
}

function unavailable(domain, method) {
  return {
    ok: false,
    code: 'UNAVAILABLE',
    message: domain + '.' + method + ' is unavailable',
  };
}

function asAsync(domain, method, call) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var out;
    try {
      out = call.apply(null, args);
    } catch (err) {
      return Promise.resolve(toError(err));
    }
    if (out && typeof out.then === 'function') {
      return Promise.resolve(out).then(
        function (data) {
          return { ok: true, data: data };
        },
        toError
      );
    }
    return Promise.resolve({ ok: true, data: out });
  };
}

function asSync(call) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    try {
      return { ok: true, data: call.apply(null, args) };
    } catch (err) {
      return toError(err);
    }
  };
}

function exposedMethods(manifest, domain) {
  var entry = manifest && manifest.domains && manifest.domains[domain];
  if (!entry || !entry.methods) return null;
  return Object.keys(entry.methods).filter(function (method) {
    return entry.methods[method].expose !== false;
  });
}

function degradedApi(manifest) {
  var api = {};
  DOMAIN_ORDER.forEach(function (domain) {
    api[domain] = {};
    var methods = exposedMethods(manifest, domain) || MINIMAL_FALLBACK[domain] || [];
    methods.forEach(function (method) {
      api[domain][method] = function () {
        return Promise.resolve(unavailable(domain, method));
      };
    });
  });
  return api;
}

function boundApi(manifest) {
  var api = {};
  DOMAIN_ORDER.forEach(function (domain) {
    api[domain] = {};
    var methods = exposedMethods(manifest, domain);
    if (!methods) return;
    var entry = manifest.domains[domain];
    var impl = null;
    try {
      impl = CAPABILITY_LOADERS[domain] ? CAPABILITY_LOADERS[domain]() : null;
    } catch (err) {
      impl = null;
    }
    methods.forEach(function (method) {
      var meta = entry.methods[method] || {};
      var call = impl && typeof impl[method] === 'function' ? impl[method] : null;
      if (!call) {
        api[domain][method] = function () {
          return Promise.resolve(unavailable(domain, method));
        };
        return;
      }
      api[domain][method] = meta.sync ? asSync(call) : asAsync(domain, method, call);
    });
  });
  return api;
}

function buildApi() {
  var manifest = null;
  try {
    manifest = require('./api-manifest');
  } catch (err) {
    manifest = null;
  }
  if (!manifest) return degradedApi(null);
  try {
    return boundApi(manifest);
  } catch (err) {
    return degradedApi(manifest);
  }
}

contextBridge.exposeInMainWorld('ossBrowser', buildApi());