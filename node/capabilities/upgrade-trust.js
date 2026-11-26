// P3（R-P3-01）：升级清单验签与完整性校验。
// 约定：签名覆盖 `version|package_url|sha256|file_name` 拼接串（ed25519 或 rsa-sha256）。
// 公钥为内置非机密数据；未配置/未知 keyId 一律拒绝（Q-1：不静默放行）。
'use strict';

const crypto = require('crypto');

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const FILENAME_RE = /^(app\.asar|\d+\.\d+\.\d+-app\.asar)$/;
const DEFAULT_KEY_ID = 'oss-browser-2026';

// 占位公钥：真实发布需替换为 ed25519/rsa 公钥（私钥仅存在于发布侧）
const PUBLIC_KEYS = {
  'oss-browser-2026': {
    algorithm: 'ed25519',
    publicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAPLACEHOLDER_PUBLIC_KEY_FOR_OSS_BROWSER_RELEASE\n-----END PUBLIC KEY-----',
  },
};

function fail(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function setPublicKeysForTest(map) {
  for (const key of Object.keys(PUBLIC_KEYS)) delete PUBLIC_KEYS[key];
  Object.assign(PUBLIC_KEYS, map || {});
}

function signingPayload(manifest) {
  return [
    String(manifest.version || ''),
    String(manifest.package_url || ''),
    String(manifest.sha256 || ''),
    String(manifest.file_name || ''),
  ].join('|');
}

function verifyManifest(manifest, opts) {
  const m = manifest || {};
  const customKeys = (opts && opts.keys) || PUBLIC_KEYS;

  if (!m.version || !VERSION_RE.test(String(m.version))) {
    throw fail('BAD_VERSION', 'version must match ^\\d+\\.\\d+\\.\\d+$');
  }

  const packageUrl = String(m.package_url || '');
  if (!/^https:\/\//i.test(packageUrl)) {
    throw fail('BAD_URL', 'package_url must be https');
  }

  if (m.file_name) {
    const name = String(m.file_name);
    if (!FILENAME_RE.test(name) || name.indexOf('..') >= 0 || /[\\/]/.test(name)) {
      throw fail('BAD_FILENAME', 'unsafe file_name');
    }
  }

  if (!m.signature || !m.algorithm) {
    throw fail('MANIFEST_UNSIGNED', 'manifest signature/algorithm missing');
  }

  const keyId = String(m.key_id || DEFAULT_KEY_ID);
  const entry = customKeys[keyId];
  if (!entry) {
    throw fail('MANIFEST_INVALID', 'unknown key_id: ' + keyId);
  }
  if (String(m.algorithm) !== entry.algorithm) {
    throw fail('MANIFEST_INVALID', 'algorithm mismatch: ' + m.algorithm);
  }
  if (!entry.publicKey || String(entry.publicKey).indexOf('PLACEHOLDER') >= 0) {
    // 占位公钥 = 未配置真实发布密钥 → 视为未签名源（显式拒绝，不静默）
    throw fail('MANIFEST_UNSIGNED', 'no release public key configured');
  }

  let verified = false;
  try {
    const data = Buffer.from(signingPayload(m), 'utf8');
    const signature = Buffer.from(String(m.signature), 'base64');
    if (entry.algorithm === 'ed25519') {
      verified = crypto.verify(null, data, entry.publicKey, signature);
    } else if (entry.algorithm === 'rsa-sha256') {
      verified = crypto.verify('sha256', data, entry.publicKey, signature);
    } else {
      throw fail('MANIFEST_INVALID', 'unsupported algorithm: ' + entry.algorithm);
    }
  } catch (err) {
    if (err && err.code) throw err;
    throw fail('BAD_SIGNATURE', (err && err.message) || 'signature verify failed');
  }

  if (!verified) {
    throw fail('BAD_SIGNATURE', 'signature mismatch');
  }
  return { ok: true, keyId: keyId, algorithm: entry.algorithm };
}

module.exports = { verifyManifest, signingPayload, setPublicKeysForTest, VERSION_RE, FILENAME_RE };