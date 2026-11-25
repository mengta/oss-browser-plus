export const LEGACY_DEFAULT_KEY = 'x82m#*lx8vv';

function credentials() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.credentials || null;
}

export function toB64(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return btoa(out);
}

function unwrap(res, fallbackMessage) {
  if (res && res.ok) {
    return res.data;
  }
  const err = new Error((res && res.message) || fallbackMessage);
  err.code = (res && res.code) || 'INTERNAL';
  throw err;
}

export function legacyCipher(plain, keyB64, algorithm) {
  const api = credentials();
  if (!api) {
    throw new Error('legacy-cipher: credentials bridge unavailable');
  }
  return unwrap(api.legacyCipher(String(plain), keyB64 || toB64(LEGACY_DEFAULT_KEY), algorithm), 'legacyCipher failed');
}

export function legacyDecipher(encrypted, keyB64, algorithm) {
  const api = credentials();
  if (!api) {
    throw new Error('legacy-cipher: credentials bridge unavailable');
  }
  return unwrap(
    api.legacyDecipher(encrypted, keyB64 || toB64(LEGACY_DEFAULT_KEY), algorithm),
    'legacyDecipher failed'
  );
}