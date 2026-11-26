'use strict';

// A-02（P3/R-P3-01）：升级清单验签 —— 五类拒绝 + 正确签名通过。
// 单测只加载纯模块 upgrade-trust.js（upgrade.js 依赖 electron，不在 ava 进程内加载）。
import test from 'ava';
import crypto from 'node:crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const trust = require('../../../node/capabilities/upgrade-trust.js');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

function installTestKey() {
  trust.setPublicKeysForTest({
    'test-key': {
      algorithm: 'ed25519',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    },
  });
}

function signed(overrides) {
  const manifest = Object.assign(
    {
      version: '1.22.0',
      package_url: 'https://example.com/releases/1.22.0-app.asar',
      sha256: 'a'.repeat(64),
      file_name: '1.22.0-app.asar',
      key_id: 'test-key',
      algorithm: 'ed25519',
    },
    overrides || {}
  );
  const payload = trust.signingPayload(manifest);
  manifest.signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  return manifest;
}

test('合法清单：ed25519 签名通过', (t) => {
  installTestKey();
  const result = trust.verifyManifest(signed());
  t.true(result.ok);
  t.is(result.keyId, 'test-key');
  t.is(result.algorithm, 'ed25519');
});

test('缺签名 → MANIFEST_UNSIGNED', (t) => {
  installTestKey();
  const m = signed();
  delete m.signature;
  const err = t.throws(() => trust.verifyManifest(m));
  t.is(err.code, 'MANIFEST_UNSIGNED');
});

test('非法版本 → BAD_VERSION', (t) => {
  installTestKey();
  const err = t.throws(() => trust.verifyManifest(signed({ version: '1.22' })));
  t.is(err.code, 'BAD_VERSION');
});

test('非 https → BAD_URL', (t) => {
  installTestKey();
  const err = t.throws(() => trust.verifyManifest(signed({ package_url: 'http://insecure/x-app.asar' })));
  t.is(err.code, 'BAD_URL');
});

test('文件名穿越 → BAD_FILENAME', (t) => {
  installTestKey();
  const err = t.throws(() => trust.verifyManifest(signed({ file_name: '../evil-app.asar' })));
  t.is(err.code, 'BAD_FILENAME');
});

test('未知 keyId → MANIFEST_INVALID', (t) => {
  installTestKey();
  const err = t.throws(() => trust.verifyManifest(signed({ key_id: 'unknown-key' })));
  t.is(err.code, 'MANIFEST_INVALID');
});

test('签名不符（篡改 version）→ BAD_SIGNATURE', (t) => {
  installTestKey();
  const m = signed();
  m.version = '9.9.9';
  const err = t.throws(() => trust.verifyManifest(m));
  t.is(err.code, 'BAD_SIGNATURE');
});

test('默认占位公钥：未配置真实发布密钥 → MANIFEST_UNSIGNED（不静默放行）', (t) => {
  trust.setPublicKeysForTest({
    'oss-browser-2026': {
      algorithm: 'ed25519',
      publicKey: '-----BEGIN PUBLIC KEY-----\nPLACEHOLDER\n-----END PUBLIC KEY-----',
    },
  });
  const err = t.throws(() => trust.verifyManifest(signed({ key_id: 'oss-browser-2026' })));
  t.is(err.code, 'MANIFEST_UNSIGNED');
});