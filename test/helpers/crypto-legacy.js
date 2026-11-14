'use strict';

// crypto 旧式 API 等价实现（R-14）：
// Node v10.0 起 crypto.createCipher/createDecipher 被废弃，Node v22 起移除。
// 旧 API 内部以 EVP_BytesToKey(MD5、无盐、单轮) 从 password 派生 key/iv，
// 其余与 createCipheriv/createDecipheriv 一致。
// 本文件提供等价实现，供：
// 1. 单测中验证 cipher.js（旧实现）的行为基线；
// 2. P2 阶段 cipher.js 正式改造（createCipheriv 版）对照同一派生语义。

const crypto = require('crypto');

const ALGO_KEY_IV = {
  aes128: { keyLen: 16, ivLen: 16 },
  'aes-128-cbc': { keyLen: 16, ivLen: 16 },
  aes192: { keyLen: 24, ivLen: 16 },
  'aes-192-cbc': { keyLen: 24, ivLen: 16 },
  aes256: { keyLen: 32, ivLen: 16 },
  'aes-256-cbc': { keyLen: 32, ivLen: 16 },
};

// EVP_BytesToKey(MD5, 无盐, 单轮)：D_i = MD5(D_{i-1} + password)
function evpBytesToKey(password, keyLen, ivLen) {
  const passBuf = Buffer.isBuffer(password) ? password : Buffer.from(String(password), 'utf8');
  const total = keyLen + ivLen;
  const d = [];
  let dLen = 0;
  let prev = Buffer.alloc(0);
  while (dLen < total) {
    prev = crypto.createHash('md5').update(Buffer.concat([prev, passBuf])).digest();
    d.push(prev);
    dLen += prev.length;
  }
  const all = Buffer.concat(d);
  return {
    key: all.slice(0, keyLen),
    iv: all.slice(keyLen, total),
  };
}

function wrapCipheriv(algorithm, key, iv, isCipher) {
  const c = isCipher
    ? crypto.createCipheriv(algorithm, key, iv)
    : crypto.createDecipheriv(algorithm, key, iv);
  return {
    update(data, inputEncoding, outputEncoding) {
      return c.update(data, inputEncoding, outputEncoding);
    },
    final(outputEncoding) {
      return c.final(outputEncoding);
    },
    setAutoPadding(v) {
      c.setAutoPadding(v);
      return this;
    },
  };
}

function legacyCreateCipher(algorithm, password) {
  const spec = ALGO_KEY_IV[algorithm];
  if (!spec) {
    throw new Error('crypto-legacy: 不支持的算法 ' + algorithm);
  }
  const { key, iv } = evpBytesToKey(password, spec.keyLen, spec.ivLen);
  return wrapCipheriv(algorithm, key, iv, true);
}

function legacyCreateDecipher(algorithm, password) {
  const spec = ALGO_KEY_IV[algorithm];
  if (!spec) {
    throw new Error('crypto-legacy: 不支持的算法 ' + algorithm);
  }
  const { key, iv } = evpBytesToKey(password, spec.keyLen, spec.ivLen);
  return wrapCipheriv(algorithm, key, iv, false);
}

// 将旧式 API 安装到 crypto 对象上（Node 22+ 下 createCipher/createDecipher 不存在）
function installLegacyCrypto() {
  if (typeof crypto.createCipher !== 'function') {
    crypto.createCipher = legacyCreateCipher;
  }
  if (typeof crypto.createDecipher !== 'function') {
    crypto.createDecipher = legacyCreateDecipher;
  }
  return crypto;
}

function uninstallLegacyCrypto() {
  delete crypto.createCipher;
  delete crypto.createDecipher;
}

module.exports = {
  evpBytesToKey,
  legacyCreateCipher,
  legacyCreateDecipher,
  installLegacyCrypto,
  uninstallLegacyCrypto,
};