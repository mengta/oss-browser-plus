angular.module('web').factory('SecureStore', [
  'Cipher',
  'SafeStorageClient',
  function(Cipher, SafeStorageClient) {
    // SecureStore：v2 凭证存储门面（credential-security design I-2 / D-2 / D-3 / D-5 / D-8 / D-13）。
    // 密文体系：'enc:v2:'（safeStorage 信封 DEK + AES-256-GCM）/ 'enc:v2d:'（降级实例级随机 DEK）；
    // Vue3-P0-16：AES-GCM/随机数改经 credentials 白名单与 Web Crypto，渲染层不再 require('crypto')；
    // 密文前缀、DEK 槽格式（dek:p:/dek:d:）、四格式判定与惰性迁移顺序保持零变更。
    var DEK_SLOT = 'enc-dek';
    var V2_PREFIX = 'enc:v2:';
    var V2D_PREFIX = 'enc:v2d:';
    var DEK_P_PREFIX = 'dek:p:';
    var DEK_D_PREFIX = 'dek:d:';
    var HEX_RE = /^[0-9a-f]+$/;

    var dekBytes = null;
    var dekLoaded = false;
    var degradedNotified = false;
    var onDegradeCb = null;
    var onSaveErrorCb = null;

    function log(evt, key, result) {
      console.log('[SecureStore] ' + evt + ' ' + key + ' ' + result);
    }

    function credentials() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.credentials || null;
    }

    function bytesToB64(bytes) {
      var out = '';
      for (var i = 0; i < bytes.length; i++) { out += String.fromCharCode(bytes[i]); }
      return btoa(out);
    }

    function b64ToBytes(b64) {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) { out[i] = bin.charCodeAt(i); }
      return out;
    }

    function utf8ToB64(text) {
      return btoa(unescape(encodeURIComponent(text)));
    }

    function b64ToUtf8(b64) {
      return decodeURIComponent(escape(atob(b64)));
    }

    function randomBytes(length) {
      var source = typeof crypto !== 'undefined' ? crypto : window.crypto;
      var buf = new Uint8Array(length);
      source.getRandomValues(buf);
      return buf;
    }

    // DEK 装载状态机（design 2.1.3-(2)）：
    //   p 态 + release 成功 → 内存缓存（场景 A）；
    //   p 态 + 不可用/释放失败 → 新随机 DEK 覆写 d 态（场景 B，旧 v2 数据按数据不存在处理）；
    //   d 态 + 保护可用 → 同字节重保护写回 p 态（场景 D，v2d 数据因 DEK 不变仍可读）；
    //   槽缺失 → 新建（保护可用写 p 态，否则写 d 态）。
    // 会话内装载一次即缓存（场景 C：运行中 keychain 变化零影响已存数据）。
    function getDek() {
      if (dekLoaded) {
        return dekBytes;
      }

      dekLoaded = true;
      var slot = localStorage.getItem(DEK_SLOT);

      if (slot && slot.indexOf(DEK_P_PREFIX) === 0) {
        var released = null;
        if (SafeStorageClient.isAvailable()) {
          released = SafeStorageClient.release(slot.slice(DEK_P_PREFIX.length));
        }
        if (released) {
          dekBytes = b64ToBytes(released);
          return dekBytes;
        }
        dekBytes = randomBytes(32);
        localStorage.setItem(DEK_SLOT, DEK_D_PREFIX + bytesToB64(dekBytes));
        log('dek-degrade-rebuild', DEK_SLOT, 'ok');
        return dekBytes;
      }

      if (slot && slot.indexOf(DEK_D_PREFIX) === 0) {
        dekBytes = b64ToBytes(slot.slice(DEK_D_PREFIX.length));
        if (SafeStorageClient.isAvailable()) {
          var prot = SafeStorageClient.protect(bytesToB64(dekBytes));
          if (prot) {
            localStorage.setItem(DEK_SLOT, DEK_P_PREFIX + prot);
            log('dek-reprotect', DEK_SLOT, 'ok');
          }
        }
        return dekBytes;
      }

      dekBytes = randomBytes(32);
      if (SafeStorageClient.isAvailable()) {
        var p = SafeStorageClient.protect(bytesToB64(dekBytes));
        if (p) {
          localStorage.setItem(DEK_SLOT, DEK_P_PREFIX + p);
        } else {
          localStorage.setItem(DEK_SLOT, DEK_D_PREFIX + bytesToB64(dekBytes));
        }
      } else {
        localStorage.setItem(DEK_SLOT, DEK_D_PREFIX + bytesToB64(dekBytes));
      }
      return dekBytes;
    }

    // 密文 = prefix + base64(iv12 | tag16 | ct)，AES-256-GCM（白名单返回同一字节布局）
    function gcmEncrypt(plain, prefix) {
      try {
        var api = credentials();
        if (!api) { return null; }
        var dek = getDek();
        if (!dek) { return null; }
        var res = api.aesGcmEncrypt(bytesToB64(dek), utf8ToB64(plain));
        if (!res || !res.ok || typeof res.data !== 'string') { return null; }
        return prefix + res.data;
      } catch (e) {
        return null;
      }
    }

    function gcmDecrypt(raw, prefix) {
      try {
        var api = credentials();
        if (!api) { return null; }
        var dek = getDek();
        if (!dek) { return null; }
        var res = api.aesGcmDecrypt(bytesToB64(dek), raw.slice(prefix.length));
        if (!res || !res.ok || typeof res.data !== 'string') { return null; }
        return b64ToUtf8(res.data);
      } catch (e) {
        return null;
      }
    }

    function encrypt(plain) {
      // 写入路径统一前置实时能力检测（design 2.1.3-(5)）：
      // 保护可用 → v2；不可用 → v2d + 首次降级写入触发 onDegrade 一次（D-7）
      if (SafeStorageClient.isAvailable()) {
        return gcmEncrypt(plain, V2_PREFIX);
      }
      if (!degradedNotified) {
        degradedNotified = true;
        if (onDegradeCb) {
          try { onDegradeCb(); } catch (cbErr) {}
        }
      }
      return gcmEncrypt(plain, V2D_PREFIX);
    }

    function decode(raw, opts) {
      if (raw === null || raw === '') {
        return { format: 'empty', plain: null };
      }
      if (raw.indexOf(V2_PREFIX) === 0) {
        var p2 = gcmDecrypt(raw, V2_PREFIX);
        if (p2 !== null) {
          return { format: 'v2', plain: p2 };
        }
        return { format: 'corrupt', plain: null };
      }
      if (raw.indexOf(V2D_PREFIX) === 0) {
        var pd = gcmDecrypt(raw, V2D_PREFIX);
        if (pd !== null) {
          return { format: 'v2d', plain: pd };
        }
        return { format: 'corrupt', plain: null };
      }
      if (HEX_RE.test(raw) && raw.length >= 32 && raw.length % 2 === 0) {
        try {
          var p1 = Cipher.decipher(raw);
          return { format: 'v1', plain: p1 };
        } catch (e) {}
      }
      if (opts && opts.legacyPlain) {
        return { format: 'v0', plain: raw };
      }
      return { format: 'corrupt', plain: null };
    }

    function decrypt(raw, opts) {
      return decode(raw, opts).plain;
    }

    function get(key, defv, opts) {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === '') {
        return defv;
      }

      var d = decode(raw, opts);

      if (d.format === 'v2') {
        return d.plain;
      }

      if (d.format === 'v2d') {
        // D-13：保护可用时机会升级为 v2（失败保留 v2d 原值）
        if (SafeStorageClient.isAvailable()) {
          var up = gcmEncrypt(d.plain, V2_PREFIX);
          if (up) {
            try {
              localStorage.setItem(key, up);
              log('upgrade', key, 'ok');
            } catch (setItemErr) {
              log('upgrade', key, 'fail');
            }
          }
        }
        return d.plain;
      }

      if (d.format === 'v1' || d.format === 'v0') {
        // 惰性迁移：v2/v2d 加密写回覆盖原值（单键原子替换，5.3.1-3）；
        // 失败保留原值本次仍返回明文（5.3.1-4，下次读取重试）
        var enc = encrypt(d.plain);
        if (enc) {
          try {
            localStorage.setItem(key, enc);
            log('migrate', key, 'ok');
          } catch (setItemErr) {
            log('migrate', key, 'fail');
          }
        } else {
          log('migrate', key, 'fail');
        }
        return d.plain;
      }

      // 损坏值：按数据不存在返回默认值，原值保留（5.3.1-5，不阻断他键）
      log('corrupt', key, 'defv');
      return defv;
    }

    function set(key, plain) {
      var enc = encrypt(plain);
      if (!enc) {
        if (onSaveErrorCb) {
          try { onSaveErrorCb(key); } catch (cbErr) {}
        }
        log('set', key, 'fail');
        return false;
      }
      try {
        localStorage.setItem(key, enc);
      } catch (setItemErr) {
        if (onSaveErrorCb) {
          try { onSaveErrorCb(key); } catch (cbErr) {}
        }
        log('set', key, 'fail');
        return false;
      }
      return true;
    }

    function remove(key) {
      localStorage.removeItem(key);
    }

    function onDegrade(cb) {
      onDegradeCb = cb;
    }

    function onSaveError(cb) {
      onSaveErrorCb = cb;
    }

    return {
      encrypt: encrypt,
      decrypt: decrypt,
      get: get,
      set: set,
      remove: remove,
      onDegrade: onDegrade,
      onSaveError: onSaveError
    };
  }
]);