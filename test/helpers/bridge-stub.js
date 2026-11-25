'use strict';

// bridge-stub：向 globalThis.window 注入 ossBrowser 白名单替身（Vue3-P0-16）。
// credentials/digest 用真实 Node crypto 实现（与 preload 侧语义一致），safeStorage 由调用方注入。
// 目的：渲染层服务去 Node 后，单测仍可验证密文格式与迁移语义（不改断言）。

const crypto = require('crypto');

const GCM_ALGO = 'aes-256-gcm';
const DEFAULT_SAFE_STORAGE = {
  isEncryptionAvailable() {
    return false;
  },
  encryptString() {
    return null;
  },
  decryptString() {
    return null;
  },
};

const LEGACY_DEFAULT_KEY = Buffer.from([
  0x78, 0x38, 0x32, 0x6d, 0x23, 0x2a, 0x6c, 0x78, 0x38, 0x76, 0x76,
]);
const LEGACY_ALGO_KEY_IV = {
  aes128: { keyLen: 16, ivLen: 16 },
  'aes-128-cbc': { keyLen: 16, ivLen: 16 },
  aes192: { keyLen: 24, ivLen: 16 },
  'aes-192-cbc': { keyLen: 24, ivLen: 16 },
  aes256: { keyLen: 32, ivLen: 16 },
  'aes-256-cbc': { keyLen: 32, ivLen: 16 },
};
const LEGACY_CANONICAL = {
  aes128: 'aes-128-cbc',
  aes192: 'aes-192-cbc',
  aes256: 'aes-256-cbc',
};

function ok(data) {
  return { ok: true, data };
}

function fail(code, message) {
  return { ok: false, code, message };
}

function evpBytesToKey(password, keyLen, ivLen) {
  const passBuf = Buffer.isBuffer(password) ? password : Buffer.from(String(password), 'utf8');
  const total = keyLen + ivLen;
  const blocks = [];
  let length = 0;
  let prev = Buffer.alloc(0);
  while (length < total) {
    prev = crypto.createHash('md5').update(Buffer.concat([prev, passBuf])).digest();
    blocks.push(prev);
    length += prev.length;
  }
  const all = Buffer.concat(blocks);
  return { key: all.slice(0, keyLen), iv: all.slice(keyLen, total) };
}

function legacyKey(keyB64) {
  if (keyB64 === undefined || keyB64 === null || keyB64 === '') return LEGACY_DEFAULT_KEY;
  return Buffer.from(keyB64, 'base64');
}

function legacyResolve(algorithm) {
  const name = algorithm || 'aes192';
  const spec = LEGACY_ALGO_KEY_IV[name];
  if (!spec) throw new Error('unsupported algorithm ' + name);
  return { name, spec };
}

function defaultSafeStorage() {
  try {
    const electron = require('electron');
    return electron && electron.safeStorage ? electron.safeStorage : DEFAULT_SAFE_STORAGE;
  } catch (err) {
    return DEFAULT_SAFE_STORAGE;
  }
}

function createBridge(options) {
  const safeStorage = (options && options.safeStorage) || defaultSafeStorage();
  const api = {
    credentials: {
      isAvailable() {
        try {
          const value = safeStorage.isEncryptionAvailable();
          return ok(value === true);
        } catch (err) {
          return ok(false);
        }
      },
      protect(plainB64) {
        try {
          const out = safeStorage.encryptString(plainB64);
          return ok(out ? Buffer.from(out).toString('base64') : null);
        } catch (err) {
          return ok(null);
        }
      },
      release(protectedB64) {
        try {
          const out = safeStorage.decryptString(Buffer.from(protectedB64, 'base64'));
          return ok(out || null);
        } catch (err) {
          return ok(null);
        }
      },
      aesGcmEncrypt(keyB64, plainB64) {
        try {
          const key = Buffer.from(keyB64, 'base64');
          const iv = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv(GCM_ALGO, key, iv);
          const ct = Buffer.concat([cipher.update(Buffer.from(plainB64, 'base64')), cipher.final()]);
          return ok(Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64'));
        } catch (err) {
          return fail('INTERNAL', err.message);
        }
      },
      aesGcmDecrypt(keyB64, cipherB64) {
        try {
          const key = Buffer.from(keyB64, 'base64');
          const buf = Buffer.from(cipherB64, 'base64');
          if (buf.length < 28) return fail('INVALID_ARG', 'cipher too short');
          const iv = buf.slice(0, 12);
          const tag = buf.slice(12, 28);
          const ct = buf.slice(28);
          const decipher = crypto.createDecipheriv(GCM_ALGO, key, iv);
          decipher.setAuthTag(tag);
          return ok(Buffer.concat([decipher.update(ct), decipher.final()]).toString('base64'));
        } catch (err) {
          return fail('INTERNAL', err.message);
        }
      },
      legacyCipher(plain, keyB64, algorithm) {
        try {
          const algo = legacyResolve(algorithm);
          const ki = evpBytesToKey(legacyKey(keyB64), algo.spec.keyLen, algo.spec.ivLen);
          const cipher = crypto.createCipheriv(LEGACY_CANONICAL[algo.name] || algo.name, ki.key, ki.iv);
          const source = Buffer.isBuffer(plain) ? plain : Buffer.from(String(plain), 'utf8');
          return ok(cipher.update(source, null, 'hex') + cipher.final('hex'));
        } catch (err) {
          return fail('INTERNAL', err.message);
        }
      },
      legacyDecipher(encrypted, keyB64, algorithm) {
        try {
          const algo = legacyResolve(algorithm);
          const ki = evpBytesToKey(legacyKey(keyB64), algo.spec.keyLen, algo.spec.ivLen);
          const decipher = crypto.createDecipheriv(LEGACY_CANONICAL[algo.name] || algo.name, ki.key, ki.iv);
          return ok(decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8'));
        } catch (err) {
          return fail('INTERNAL', err.message);
        }
      },
    },
    system: {
      pathDirname(target) {
        return ok(require('path').dirname(target));
      },
      pathJoin(parts) {
        return ok(require('path').join.apply(require('path'), parts));
      },
      pathBasename(target) {
        return ok(require('path').basename(target));
      },
      pathRelative(from, to) {
        return ok(require('path').relative(from, to));
      },
    },
    digest: {
      sha256Hex(text) {
        try {
          return ok(crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'));
        } catch (err) {
          return fail('INTERNAL', err.message);
        }
      },
    },
  };

  globalThis.window = { ossBrowser: api };
  return api;
}

function clearBridge() {
  delete globalThis.window;
}

module.exports = { createBridge, clearBridge };