angular.module('web').factory('Cipher', function() {
  // Vue3-P0-16：v1 兼容加解密改经 credentials 白名单（同步），渲染层不再 require('crypto')；
  // 派生语义（EVP_BytesToKey MD5 无盐单轮）与密文输出零变更（锚点见 cipher.test.mjs）。
  function api() {
    if (typeof window === 'undefined' || !window.ossBrowser) {
      throw new Error('Cipher: credentials bridge unavailable');
    }
    return window.ossBrowser.credentials;
  }

  function toB64(value) {
    if (value === undefined || value === null) { return ''; }
    if (typeof value === 'string') {
      return btoa(unescape(encodeURIComponent(value)));
    }
    var bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    var out = '';
    for (var i = 0; i < bytes.length; i++) { out += String.fromCharCode(bytes[i]); }
    return btoa(out);
  }

  function utf8Of(value) {
    if (typeof value === 'string') { return value; }
    var bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function unwrap(res, fallbackMessage) {
    if (res && res.ok) { return res.data; }
    throw new Error((res && res.message) || fallbackMessage);
  }

  function cipher(buf, key, algorithm) {
    return unwrap(api().legacyCipher(utf8Of(buf), toB64(key), algorithm), 'cipher failed');
  }

  function decipher(encrypted, key, algorithm) {
    return unwrap(api().legacyDecipher(encrypted, toB64(key), algorithm), 'decipher failed');
  }

  return {
    cipher: cipher,
    decipher: decipher
  };
});