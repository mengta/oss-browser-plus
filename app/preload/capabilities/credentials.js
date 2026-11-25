'use strict';

const crypto = require('crypto');
const { ipcRenderer } = require('electron');

const SYNC_CHANNELS = {
  isAvailable: 'credentials:is-available',
  protect: 'credentials:protect',
  release: 'credentials:release',
};

const GCM_ALGO = 'aes-256-gcm';
const GCM_IV_LEN = 12;
const GCM_TAG_LEN = 16;

const LEGACY_DEFAULT_ALGORITHM = 'aes192';
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

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function syncCall(channel, args) {
  const res = ipcRenderer.sendSync.apply(ipcRenderer, [channel].concat(args || []));
  if (res && res.ok === false) {
    throw codedError(res.code || 'INTERNAL', res.message || channel + ' failed');
  }
  return res && res.ok === true ? res.data : res;
}

function decodeKey(keyB64) {
  if (typeof keyB64 !== 'string' || !keyB64) throw codedError('INVALID_ARG', 'keyB64 is required');
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw codedError('INVALID_ARG', 'key must be 32 bytes');
  return key;
}

function legacyKey(keyB64) {
  if (keyB64 === undefined || keyB64 === null || keyB64 === '') return LEGACY_DEFAULT_KEY;
  if (typeof keyB64 !== 'string') throw codedError('INVALID_ARG', 'key must be base64 string');
  return Buffer.from(keyB64, 'base64');
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

function legacyResolve(algorithm) {
  const name = algorithm || LEGACY_DEFAULT_ALGORITHM;
  const spec = LEGACY_ALGO_KEY_IV[name];
  if (!spec) throw codedError('INVALID_ARG', 'unsupported algorithm ' + name);
  return { name: name, spec: spec };
}

function isAvailable() {
  return syncCall(SYNC_CHANNELS.isAvailable, []);
}

function protect(plainB64) {
  if (typeof plainB64 !== 'string') throw codedError('INVALID_ARG', 'plainB64 must be a string');
  return syncCall(SYNC_CHANNELS.protect, [plainB64]);
}

function release(protectedB64) {
  if (typeof protectedB64 !== 'string') throw codedError('INVALID_ARG', 'protectedB64 must be a string');
  return syncCall(SYNC_CHANNELS.release, [protectedB64]);
}

function aesGcmEncrypt(keyB64, plainB64) {
  const key = decodeKey(keyB64);
  if (typeof plainB64 !== 'string') throw codedError('INVALID_ARG', 'plainB64 must be a string');
  const iv = crypto.randomBytes(GCM_IV_LEN);
  const cipher = crypto.createCipheriv(GCM_ALGO, key, iv);
  const plain = Buffer.from(plainB64, 'base64');
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

function aesGcmDecrypt(keyB64, cipherB64) {
  const key = decodeKey(keyB64);
  if (typeof cipherB64 !== 'string' || !cipherB64) throw codedError('INVALID_ARG', 'cipherB64 is required');
  const buf = Buffer.from(cipherB64, 'base64');
  if (buf.length < GCM_IV_LEN + GCM_TAG_LEN) throw codedError('INVALID_ARG', 'cipher too short');
  const iv = buf.slice(0, GCM_IV_LEN);
  const tag = buf.slice(GCM_IV_LEN, GCM_IV_LEN + GCM_TAG_LEN);
  const ct = buf.slice(GCM_IV_LEN + GCM_TAG_LEN);
  const decipher = crypto.createDecipheriv(GCM_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('base64');
}

function legacyCipher(plain, keyB64, algorithm) {
  const algo = legacyResolve(algorithm);
  const ki = evpBytesToKey(legacyKey(keyB64), algo.spec.keyLen, algo.spec.ivLen);
  const cipher = crypto.createCipheriv(LEGACY_CANONICAL[algo.name] || algo.name, ki.key, ki.iv);
  const source = Buffer.isBuffer(plain) ? plain : Buffer.from(String(plain), 'utf8');
  return cipher.update(source, null, 'hex') + cipher.final('hex');
}

function legacyDecipher(encrypted, keyB64, algorithm) {
  if (typeof encrypted !== 'string') throw codedError('INVALID_ARG', 'cipher text must be a string');
  const algo = legacyResolve(algorithm);
  const ki = evpBytesToKey(legacyKey(keyB64), algo.spec.keyLen, algo.spec.ivLen);
  const decipher = crypto.createDecipheriv(LEGACY_CANONICAL[algo.name] || algo.name, ki.key, ki.iv);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

module.exports = {
  isAvailable,
  protect,
  release,
  aesGcmEncrypt,
  aesGcmDecrypt,
  legacyCipher,
  legacyDecipher,
};