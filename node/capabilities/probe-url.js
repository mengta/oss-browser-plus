// P3（R-P3-04）：外网地址探测下沉到主进程（渲染层 CSP 收紧后不再直连）。
// 语义与原渲染层 fetch 等价：Range: bytes=0-1 + no-cache，3s 超时；返回 { status, ok, body }。
'use strict';

const { logger } = require('../lib/logger');

const log = logger('probe');
const DEFAULT_TIMEOUT = 3000;

async function probeUrl(target, opts) {
  if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) {
    const err = new Error('invalid url');
    err.code = 'INVALID_ARG';
    throw err;
  }
  const timeoutMs = Number(opts && opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: { Range: 'bytes=0-1', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
      redirect: 'follow',
    });
    let body = '';
    try {
      body = await res.text();
    } catch (err) {
      body = '';
    }
    if (body.length > 512) body = body.slice(0, 512);
    return { status: res.status, ok: res.status >= 200 && res.status <= 300, body: body };
  } catch (err) {
    log.warn('probe.failed', 'url probe failed', { code: (err && err.code) || 'PROBE_FAILED' });
    const out = new Error((err && err.message) || 'probe failed');
    out.code = (err && err.name) === 'AbortError' ? 'TIMEOUT' : (err && err.code) || 'PROBE_FAILED';
    throw out;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { probeUrl };