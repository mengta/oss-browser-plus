// P4（R-P4-05）：渲染层错误上报限流（滑动窗口 + 内容哈希去重）。
'use strict';

const crypto = require('crypto');

function createRateLimiter(options) {
  const opts = options || {};
  const windowMs = opts.windowMs || 60000;
  const maxPerWindow = opts.maxPerWindow || 20;
  const dedupeMs = opts.dedupeMs || 5000;
  const buckets = new Map();
  const seen = new Map();

  function digest(payload) {
    return crypto
      .createHash('sha1')
      .update(String(payload || ''))
      .digest('hex');
  }

  function allow(value) {
    const now = Date.now();
    const key = digest(value);

    const last = seen.get(key);
    if (last && now - last < dedupeMs) {
      return { allowed: false, reason: 'duplicate' };
    }
    seen.set(key, now);

    let bucket = buckets.get('global');
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set('global', bucket);
    }
    if (bucket.count >= maxPerWindow) {
      return { allowed: false, reason: 'rate-limited' };
    }
    bucket.count += 1;

    for (const [k, ts] of seen) {
      if (now - ts > Math.max(windowMs, dedupeMs)) seen.delete(k);
    }
    return { allowed: true, count: bucket.count };
  }

  function reset() {
    buckets.clear();
    seen.clear();
  }

  return { allow, reset };
}

module.exports = { createRateLimiter };