'use strict';

// A-02 补充（P3/R-P3-04）：外网探测下沉主进程 —— 200/403/超时三态。
import test from 'ava';
import http from 'node:http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { probeUrl } = require('../../../node/capabilities/probe-url.js');

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

test('probeUrl：200 返回 ok:true 且带短 body', async (t) => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });
  const port = server.address().port;
  try {
    const result = await probeUrl('http://127.0.0.1:' + port + '/x');
    t.is(result.status, 200);
    t.true(result.ok);
    t.is(result.body, 'OK');
  } finally {
    await stopServer(server);
  }
});

test('probeUrl：403 返回 ok:false 且状态透出', async (t) => {
  const server = await startServer((req, res) => {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('denied');
  });
  const port = server.address().port;
  try {
    const result = await probeUrl('http://127.0.0.1:' + port + '/x');
    t.is(result.status, 403);
    t.false(result.ok);
  } finally {
    await stopServer(server);
  }
});

test('probeUrl：非法 URL → INVALID_ARG', async (t) => {
  const err = await t.throwsAsync(() => probeUrl('ftp://example.com/x'));
  t.is(err.code, 'INVALID_ARG');
});

test('probeUrl：超时 → TIMEOUT（不挂起）', async (t) => {
  const server = await startServer((req, res) => {
    // 故意不响应
    setTimeout(() => res.end('late'), 3000);
  });
  const port = server.address().port;
  try {
    const slowUrl = 'http://127.0.0.1:' + port + '/slow';
    const err = await t.throwsAsync(() => probeUrl(slowUrl, { timeoutMs: 200 }));
    t.is(err.code, 'TIMEOUT');
  } finally {
    await stopServer(server);
  }
});