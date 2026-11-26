import { invoke, resolveTimeout, normalizeResult } from './ipc.js';

export const DOMAINS = [
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

function bridge() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser;
}

function buildDomain(domain) {
  const target = {};
  const root = bridge();
  const methods = root && root[domain] ? Object.keys(root[domain]) : [];

  for (const method of methods) {
    if (typeof root[domain][method] !== 'function') {
      continue;
    }
    target[method] = (...args) =>
      invoke(
        () => {
          const live = bridge();
          if (!live || !live[domain] || typeof live[domain][method] !== 'function') {
            return { ok: false, code: 'UNAVAILABLE', message: domain + '.' + method + ' unavailable' };
          }
          return live[domain][method](...args);
        },
        domain + '.' + method,
        resolveTimeout(domain, method)
      );
  }

  return target;
}

export const api = {};
for (const domain of DOMAINS) {
  api[domain] = buildDomain(domain);
}

export function bootstrapSync() {
  const live = bridge();
  if (!live || !live.bootstrap || typeof live.bootstrap.get !== 'function') {
    return { ok: false, code: 'UNAVAILABLE', message: 'bootstrap unavailable' };
  }
  try {
    return normalizeResult(live.bootstrap.get());
  } catch (err) {
    return { ok: false, code: 'INTERNAL', message: (err && err.message) || String(err) };
  }
}

export function subscribe(domain, callback) {
  const live = bridge();
  if (!live || !live[domain] || typeof live[domain].subscribe !== 'function') {
    return () => false;
  }
  if (typeof callback !== 'function') {
    return () => false;
  }
  const subscriptionId = live[domain].subscribe(callback);
  return () => {
    const current = bridge();
    if (current && current[domain] && typeof current[domain].unsubscribe === 'function') {
      return current[domain].unsubscribe(subscriptionId);
    }
    return false;
  };
}

export const subscribeTransfer = (callback) => subscribe('transfer', callback);
export const subscribeUpgrade = (callback) => subscribe('upgrade', callback);

// B4-03：静态服务端口就绪门（1.5s 未就绪即视为失败；业务请求前可 await）
let portReadyPromise = null;
export function portReady() {
  if (!portReadyPromise) {
    portReadyPromise = invoke(
      () => {
        const live = bridge();
        if (!live || !live.system || typeof live.system.getStaticServerPort !== 'function') {
          return { ok: false, code: 'UNAVAILABLE', message: 'static server port unavailable' };
        }
        return live.system.getStaticServerPort();
      },
      'system.getStaticServerPort',
      1500
    ).then((res) => {
      if (res && res.ok && Number.isFinite(res.data)) {
        return res.data;
      }
      const err = new Error('static server port is not ready');
      err.code = 'PORT_NOT_READY';
      throw err;
    });
  }
  return portReadyPromise;
}
