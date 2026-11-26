// P4（R-P4-05 · V-10）：渲染层错误上报。1s 窗口聚合同类错误，经 api.system.reportError
// 交给主进程限流 + 脱敏落盘；上报失败不影响业务（不静默吞掉：本地控制台保留降级输出）。
import { api } from './api.js';

const buffer = new Map();
let timer = null;
let reported = 0;

function currentUrl() {
  try {
    return typeof location !== 'undefined' ? location.href : '';
  } catch (err) {
    return '';
  }
}

function flush() {
  timer = null;
  const entries = Array.from(buffer.values());
  buffer.clear();
  for (const entry of entries) {
    const system = api && api.system;
    if (!system || typeof system.reportError !== 'function') {
      return;
    }
    try {
      system.reportError({
        kind: entry.kind,
        message: entry.message,
        stack: entry.stack,
        url: currentUrl(),
        count: entry.count,
      });
      reported += 1;
    } catch (err) {
      // 主进程不可用时保留控制台降级输出（不静默）
      console.warn('[renderer-log] report failed:', err && err.message);
    }
  }
}

export function reportError(kind, err, info) {
  const message = (err && err.message) || String(err || info || 'unknown error');
  const stack = err && err.stack ? String(err.stack).slice(0, 4000) : '';
  const key = String(kind) + '|' + message;
  const entry = buffer.get(key);
  if (entry) {
    entry.count += 1;
    return;
  }
  buffer.set(key, { kind: String(kind || 'unknown'), message: message, stack: stack, count: 1 });
  if (!timer) {
    timer = setTimeout(flush, 1000);
  }
}

export function reportedCount() {
  return reported;
}