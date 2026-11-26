'use strict';

// A-01（P4/R-P4-01）：静态服务端口选择（占位端口自动切换、全占返回 UNAVAILABLE、失败已 close）。
// 使用 17xxx 高位端口，避免占用真实业务端口（7123~7126）。
import test from 'ava';
import net from 'node:net';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const staticServer = require('../../../node/capabilities/static-server.js');
const { createRateLimiter } = require('../../../node/lib/rate-limit.js');

function occupy(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    // 与 Koa 的 listen(port) 一致绑定全部接口（仅绑 127.0.0.1 时 Windows 允许 0.0.0.0 共存）
    server.listen(port, () => resolve(server));
  });
}

function release(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

test.serial('端口被占用时自动切到下一个可用端口', async (t) => {
  const occupied = await occupy(17123);
  try {
    const port = await staticServer.start([17123, 17124]);
    t.is(port, 17124);
    t.is(staticServer.current(), 17124);
  } finally {
    staticServer.stop();
    await release(occupied);
  }
});

test.serial('全部端口被占用时返回 UNAVAILABLE（不返回固定端口）', async (t) => {
  const a = await occupy(17125);
  const b = await occupy(17126);
  try {
    const err = await t.throwsAsync(() => staticServer.start([17125, 17126]));
    t.is(err.code, 'UNAVAILABLE');
    t.is(err.portErrors.length, 2);
    t.is(staticServer.current(), 0);
  } finally {
    staticServer.stop();
    await release(a);
    await release(b);
  }
});

test.serial('失败端口已 close（可立即重新占用）', async (t) => {
  const occupied = await occupy(17127);
  await staticServer.start([17127, 17128]);
  staticServer.stop();
  await release(occupied);
  const again = await occupy(17127);
  t.truthy(again);
  await release(again);
});

test('限流：窗口内超过上限拒绝，重复内容去重', (t) => {
  const limiter = createRateLimiter({ windowMs: 60000, maxPerWindow: 3, dedupeMs: 60000 });
  t.true(limiter.allow('a').allowed);
  t.false(limiter.allow('a').allowed);
  t.true(limiter.allow('b').allowed);
  t.true(limiter.allow('c').allowed);
  const over = limiter.allow('d');
  t.false(over.allowed);
  t.is(over.reason, 'rate-limited');
});