// P4（R-P4-01）：静态服务端口选择（Promise 化）。
// 旧实现用 try/catch 包 Koa 的异步 listen，捕获不到 EADDRINUSE；四端口全失败仍返回 7126。
// 本模块：逐端口 once('listening')/once('error') + close + 超时兜底，失败抛 UNAVAILABLE。
'use strict';

const koaApp = require('../../server.js');
const { logger } = require('../lib/logger');

const log = logger('static-server');
const LISTEN_TIMEOUT_MS = 500;

const state = { server: null, port: 0 };

function tryListen(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    let server;
    try {
      server = koaApp.listen(port);
    } catch (err) {
      reject(err);
      return;
    }

    const cleanup = () => {
      clearTimeout(timer);
      server.removeListener('listening', onListening);
      server.removeListener('error', onError);
    };
    const closeQuietly = () => {
      try {
        server.close(() => {});
      } catch (err) {}
    };
    const onListening = () => {
      cleanup();
      resolve(server);
    };
    const onError = (err) => {
      cleanup();
      closeQuietly();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      closeQuietly();
      const err = new Error('listen timeout on port ' + port);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);

    server.once('listening', onListening);
    server.once('error', onError);
  });
}

async function start(ports, options) {
  const list = Array.isArray(ports) && ports.length ? ports : [7123];
  const timeoutMs = (options && options.timeoutMs) || LISTEN_TIMEOUT_MS;
  const failures = [];

  for (const port of list) {
    try {
      // 逐端口串行尝试：后一端口依赖前一端口失败，属于正当串行
      const server = await tryListen(port, timeoutMs);
      state.server = server;
      state.port = port;
      log.info('port.selected', 'static server listening', { port });
      return port;
    } catch (err) {
      failures.push({ port, code: (err && err.code) || 'LISTEN_FAILED' });
      log.warn('port.conflict', 'static server port unavailable', {
        port,
        code: (err && err.code) || 'LISTEN_FAILED',
      });
    }
  }

  const error = new Error('no available static server port');
  error.code = 'UNAVAILABLE';
  error.portErrors = failures;
  log.error('port.unavailable', 'all static server ports failed', { failures });
  throw error;
}

function stop() {
  if (!state.server) return false;
  try {
    state.server.close(() => {});
  } catch (err) {}
  state.server = null;
  state.port = 0;
  return true;
}

function current() {
  return state.server ? state.port : 0;
}

module.exports = { start, stop, current };