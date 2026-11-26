// P4（R-P4-03）：日志脱敏。键名大小写无关；accessKeyId 前 4 后 4，其余全掩码。
// 同时处理 URL query 中的凭证参数、循环引用与超长字段。
'use strict';

const SENSITIVE_KEYS = [
  'accesskeyid',
  'accesskeysecret',
  'securitytoken',
  'token',
  'password',
  'pass',
  'cookie',
  'authorization',
  'signature',
];

const MAX_STRING = 2048;
const MAX_DEPTH = 6;

function isSensitive(key) {
  const lower = String(key || '').toLowerCase();
  return SENSITIVE_KEYS.some((k) => lower === k || lower.endsWith(k) || lower.indexOf(k) === 0);
}

function maskAccessKeyId(value) {
  const s = String(value);
  if (s.length <= 8) return '****';
  return s.slice(0, 4) + '****' + s.slice(-4);
}

function maskUrl(text) {
  return String(text).replace(
    /([?&](?:accessKeyId|AccessKeyId|access_key_id|securityToken|SecurityToken|token|signature|Signature|OSSAccessKeyId)=)([^&#\s]+)/g,
    (all, head, val) => head + (head.toLowerCase().indexOf('accesskeyid') >= 0 || head.toLowerCase().indexOf('ossaccesskeyid') >= 0
      ? maskAccessKeyId(decodeURIComponent(val))
      : '***')
  );
}

function redact(value, key, depth) {
  const level = depth || 0;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (isSensitive(key)) {
      return /accesskeyid/i.test(String(key)) ? maskAccessKeyId(value) : '***';
    }
    const masked = maskUrl(value);
    return masked.length > MAX_STRING ? masked.slice(0, MAX_STRING) + '...[truncated]' : masked;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return '<<function>>';
  if (level >= MAX_DEPTH) return '<<max-depth>>';
  if (Array.isArray(value)) return value.map((item) => redact(item, key, level + 1));
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function' && !value.__redacted) {
      try {
        return redact(value.toJSON(), key, level + 1);
      } catch (err) {
        return '<<unserializable>>';
      }
    }
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = redact(value[k], k, level + 1);
    }
    return out;
  }
  return '<<unserializable>>';
}

function redactText(text) {
  const masked = maskUrl(String(text));
  return masked.length > MAX_STRING ? masked.slice(0, MAX_STRING) + '...[truncated]' : masked;
}

module.exports = { redact, redactText, isSensitive, maskAccessKeyId, SENSITIVE_KEYS };