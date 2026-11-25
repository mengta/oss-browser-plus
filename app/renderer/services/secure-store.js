import { legacyDecipher } from './legacy-cipher.js';

const DEK_SLOT = 'enc-dek';
const V2_PREFIX = 'enc:v2:';
const V2D_PREFIX = 'enc:v2d:';
const DEK_P_PREFIX = 'dek:p:';
const DEK_D_PREFIX = 'dek:d:';
const HEX_RE = /^[0-9a-f]+$/;

let dekBytes = null;
let dekLoaded = false;
let degradedNotified = false;
let onDegradeCb = null;
let onSaveErrorCb = null;

function credentials() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.credentials || null;
}

function safeStorageIsAvailable() {
  const api = credentials();
  if (!api) {
    return false;
  }
  try {
    const res = api.isAvailable();
    return !!(res && res.ok && res.data === true);
  } catch (err) {
    return false;
  }
}

function safeStorageProtect(plainB64) {
  const api = credentials();
  if (!api) {
    return null;
  }
  try {
    const res = api.protect(plainB64);
    return res && res.ok ? res.data : null;
  } catch (err) {
    return null;
  }
}

function safeStorageRelease(protectedB64) {
  const api = credentials();
  if (!api) {
    return null;
  }
  try {
    const res = api.release(protectedB64);
    return res && res.ok ? res.data : null;
  } catch (err) {
    return null;
  }
}

function bytesToB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return btoa(out);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function utf8ToB64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function b64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function randomBytes(length) {
  const source = typeof crypto !== 'undefined' ? crypto : window.crypto;
  const buf = new Uint8Array(length);
  source.getRandomValues(buf);
  return buf;
}

function getDek() {
  if (dekLoaded) {
    return dekBytes;
  }
  dekLoaded = true;
  const slot = localStorage.getItem(DEK_SLOT);

  if (slot && slot.indexOf(DEK_P_PREFIX) === 0) {
    const released = safeStorageIsAvailable() ? safeStorageRelease(slot.slice(DEK_P_PREFIX.length)) : null;
    if (released) {
      dekBytes = b64ToBytes(released);
      return dekBytes;
    }
    dekBytes = randomBytes(32);
    localStorage.setItem(DEK_SLOT, DEK_D_PREFIX + bytesToB64(dekBytes));
    return dekBytes;
  }

  if (slot && slot.indexOf(DEK_D_PREFIX) === 0) {
    dekBytes = b64ToBytes(slot.slice(DEK_D_PREFIX.length));
    if (safeStorageIsAvailable()) {
      const prot = safeStorageProtect(bytesToB64(dekBytes));
      if (prot) {
        localStorage.setItem(DEK_SLOT, DEK_P_PREFIX + prot);
      }
    }
    return dekBytes;
  }

  dekBytes = randomBytes(32);
  if (safeStorageIsAvailable()) {
    const prot = safeStorageProtect(bytesToB64(dekBytes));
    localStorage.setItem(DEK_SLOT, prot ? DEK_P_PREFIX + prot : DEK_D_PREFIX + bytesToB64(dekBytes));
  } else {
    localStorage.setItem(DEK_SLOT, DEK_D_PREFIX + bytesToB64(dekBytes));
  }
  return dekBytes;
}

function gcmEncrypt(plain, prefix) {
  try {
    const api = credentials();
    if (!api) {
      return null;
    }
    const dek = getDek();
    if (!dek) {
      return null;
    }
    const res = api.aesGcmEncrypt(bytesToB64(dek), utf8ToB64(plain));
    if (!res || !res.ok || typeof res.data !== 'string') {
      return null;
    }
    return prefix + res.data;
  } catch (err) {
    return null;
  }
}

function gcmDecrypt(raw, prefix) {
  try {
    const api = credentials();
    if (!api) {
      return null;
    }
    const dek = getDek();
    if (!dek) {
      return null;
    }
    const res = api.aesGcmDecrypt(bytesToB64(dek), raw.slice(prefix.length));
    if (!res || !res.ok || typeof res.data !== 'string') {
      return null;
    }
    return b64ToUtf8(res.data);
  } catch (err) {
    return null;
  }
}

export function encrypt(plain) {
  if (safeStorageIsAvailable()) {
    return gcmEncrypt(plain, V2_PREFIX);
  }
  if (!degradedNotified) {
    degradedNotified = true;
    if (onDegradeCb) {
      try {
        onDegradeCb();
      } catch (err) {}
    }
  }
  return gcmEncrypt(plain, V2D_PREFIX);
}

export function decode(raw, opts) {
  if (raw === null || raw === '') {
    return { format: 'empty', plain: null };
  }
  if (raw.indexOf(V2_PREFIX) === 0) {
    const plainV2 = gcmDecrypt(raw, V2_PREFIX);
    return plainV2 !== null ? { format: 'v2', plain: plainV2 } : { format: 'corrupt', plain: null };
  }
  if (raw.indexOf(V2D_PREFIX) === 0) {
    const plainV2d = gcmDecrypt(raw, V2D_PREFIX);
    return plainV2d !== null ? { format: 'v2d', plain: plainV2d } : { format: 'corrupt', plain: null };
  }
  if (HEX_RE.test(raw) && raw.length >= 32 && raw.length % 2 === 0) {
    try {
      return { format: 'v1', plain: legacyDecipher(raw) };
    } catch (err) {}
  }
  if (opts && opts.legacyPlain) {
    return { format: 'v0', plain: raw };
  }
  return { format: 'corrupt', plain: null };
}

export function decrypt(raw, opts) {
  return decode(raw, opts).plain;
}

export function get(key, defv, opts) {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === '') {
    return defv;
  }

  const d = decode(raw, opts);

  if (d.format === 'v2') {
    return d.plain;
  }

  if (d.format === 'v2d') {
    if (safeStorageIsAvailable()) {
      const upgraded = gcmEncrypt(d.plain, V2_PREFIX);
      if (upgraded) {
        try {
          localStorage.setItem(key, upgraded);
        } catch (err) {}
      }
    }
    return d.plain;
  }

  if (d.format === 'v1' || d.format === 'v0') {
    const enc = encrypt(d.plain);
    if (enc) {
      try {
        localStorage.setItem(key, enc);
      } catch (err) {}
    }
    return d.plain;
  }

  return defv;
}

export function set(key, plain) {
  const enc = encrypt(plain);
  if (!enc) {
    if (onSaveErrorCb) {
      try {
        onSaveErrorCb(key);
      } catch (err) {}
    }
    return false;
  }
  try {
    localStorage.setItem(key, enc);
  } catch (err) {
    if (onSaveErrorCb) {
      try {
        onSaveErrorCb(key);
      } catch (e) {}
    }
    return false;
  }
  return true;
}

export function remove(key) {
  localStorage.removeItem(key);
}

export function onDegrade(cb) {
  onDegradeCb = cb;
}

export function onSaveError(cb) {
  onSaveErrorCb = cb;
}

export function resetDekCache() {
  dekBytes = null;
  dekLoaded = false;
  degradedNotified = false;
}