angular.module('web').factory('Cipher', function() {
  var crypto = require('crypto');
  var ALGORITHM = 'aes192';
  var KEY = 'x82m#*lx8vv';

  // R-14（升级文档 6 章）：crypto.createCipher/createDecipher 于 Node 22+ / Electron 45 移除，
  // 此处以 createCipheriv + EVP_BytesToKey(MD5、无盐、单轮) 等价替换，
  // 密文/明文与旧 API 完全一致（单测锚点 test/unit/components/services/cipher.test.mjs 锁定）。
  var ALGO_KEY_IV = {
    aes128: { keyLen: 16, ivLen: 16 },
    'aes-128-cbc': { keyLen: 16, ivLen: 16 },
    aes192: { keyLen: 24, ivLen: 16 },
    'aes-192-cbc': { keyLen: 24, ivLen: 16 },
    aes256: { keyLen: 32, ivLen: 16 },
    'aes-256-cbc': { keyLen: 32, ivLen: 16 }
  };

  // EVP_BytesToKey(MD5, 无盐, 单轮)：D_i = MD5(D_{i-1} + password)
  function evpBytesToKey(password, keyLen, ivLen) {
    var passBuf = Buffer.isBuffer(password)
        ? password
        : Buffer.from(String(password), 'utf8');
    var total = keyLen + ivLen;
    var d = [];
    var dLen = 0;
    var prev = Buffer.alloc(0);
    while (dLen < total) {
      prev = crypto
          .createHash('md5')
          .update(Buffer.concat([prev, passBuf]))
          .digest();
      d.push(prev);
      dLen += prev.length;
    }
    var all = Buffer.concat(d);
    return {
      key: all.slice(0, keyLen),
      iv: all.slice(keyLen, total)
    };
  }

  function resolve(algorithm) {
    var name = algorithm || ALGORITHM;
    var spec = ALGO_KEY_IV[name];
    if (!spec) {
      throw new Error('Cipher: unsupported algorithm ' + name);
    }
    return { name: name, spec: spec };
  }

  return {
    cipher: cipher,
    decipher: decipher
  };

  function cipher(buf, key, algorithm) {
    if (!(buf instanceof Buffer)) {
      buf = Buffer.from(String(buf), 'utf8');
    }

    var algo = resolve(algorithm);
    var ki = evpBytesToKey(key || KEY, algo.spec.keyLen, algo.spec.ivLen);
    var cip = crypto.createCipheriv(algo.name, ki.key, ki.iv);

    var encrypted = '';
    encrypted += cip.update(buf, 'utf8', 'hex');
    encrypted += cip['final']('hex');

    return encrypted;
  }

  function decipher(encrypted, key, algorithm) {
    var algo = resolve(algorithm);
    var ki = evpBytesToKey(key || KEY, algo.spec.keyLen, algo.spec.ivLen);
    var dcp = crypto.createDecipheriv(algo.name, ki.key, ki.iv);

    var decrypted = '';
    decrypted += dcp.update(encrypted, 'hex', 'utf8');
    decrypted += dcp['final']('utf8');

    return decrypted;
  }
});
