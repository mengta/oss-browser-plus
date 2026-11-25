'use strict';

// cipher.js 基线单测（源 app/components/services/cipher.js）
// R-14 密文锚点：aes192 + 默认 key 的固定明文→固定密文映射。
// 自凭证安全整改（CS-01）起锚点语义转正（design D-15 前半）：
//   ① 存量密文兼容读：decipher(ANCHOR_CIPHER_HEX) === ANCHOR_PLAIN（迁移能力存续期冻结）；
//   ② v2 新格式脱离静态密钥：SecureStore 加密同一明文 !== ANCHOR_CIPHER_HEX 且带 'enc:v2:' 前缀。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubLocalStorage, restoreEnv } from '../../../helpers/env-stubs.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';
import { installLegacyCrypto } from '../../../helpers/crypto-legacy.js';
import { createBridge } from '../../../helpers/bridge-stub.js';

const KEY = 'x82m#*lx8vv';
// 兼容读锚点：createCipher(aes192) 旧 API 输出（EVP_BytesToKey MD5 无盐单轮派生）
// 权威来源：Electron 1.8.4（内置 Node 8.2.1）旧 createCipher 实测输出，2026-11-14
const ANCHOR_PLAIN = 'oss-browser-anchor-2026';
const ANCHOR_CIPHER_HEX =
  'b3bdfaf3ea17bbb93edc996b5e3cd1c06c388187cc904886186a26b0d44f18c0';

function loadCipher() {
  createBridge();
  installLegacyCrypto();
  const reg = stubAngular();
  reg.load('app/components/services/cipher.js');
  return reg.get('Cipher');
}

test('加解密往返一致且密文异于明文', (t) => {
  const Cipher = loadCipher();
  const plain = 'hello oss-browser 中文样本';
  const encrypted = Cipher.cipher(plain);
  const decrypted = Cipher.decipher(encrypted);

  t.is(decrypted, plain);
  t.not(encrypted, plain);
  t.regex(encrypted, /^[0-9a-f]+$/);
});

test('存量密文兼容读锚点（R-14 → CS-01 转正：decipher 可解存量密文）', (t) => {
  const Cipher = loadCipher();

  // 锚点注释：v1 兼容读存续至迁移能力下线（风险台账 R-18），本断言必须保持通过
  t.is(Cipher.decipher(ANCHOR_CIPHER_HEX), ANCHOR_PLAIN);
});

test('v2 新格式密文脱离静态密钥（锚点第二断言：SecureStore 加密同一明文）', (t) => {
  const fakeSafeStorage = {
    isEncryptionAvailable() {
      return true;
    },
    encryptString(s) {
      return Buffer.from('fake-os|' + s);
    },
    decryptString(buf) {
      const str = buf.toString('utf8');
      if (str.indexOf('fake-os|') !== 0) {
        throw new Error('not protected by fake os');
      }
      return str.slice('fake-os|'.length);
    },
  };
  stubModule('electron', { safeStorage: fakeSafeStorage });
  createBridge();
  stubLocalStorage({});
  const reg = stubAngular();
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/safe-storage-client.js');
  reg.load('app/components/services/secure-store.js');
  const SecureStore = reg.get('SecureStore');

  const enc = SecureStore.encrypt(ANCHOR_PLAIN);
  t.not(enc, ANCHOR_CIPHER_HEX);
  t.true(enc.indexOf('enc:v2:') === 0);

  t.teardown(() => {
    unstubAll();
    restoreEnv();
  });
});

test('自定义 key 与自定义 algorithm 覆盖默认值', (t) => {
  const Cipher = loadCipher();
  const plain = 'custom-key-sample';
  const encDefault = Cipher.cipher(plain);
  const encCustomKey = Cipher.cipher(plain, 'another-key-123');
  const encCustomAlgo = Cipher.cipher(plain, KEY, 'aes256');

  t.not(encCustomKey, encDefault);
  t.not(encCustomAlgo, encDefault);

  t.is(Cipher.decipher(encCustomKey, 'another-key-123'), plain);
  t.is(Cipher.decipher(encCustomAlgo, KEY, 'aes256'), plain);
});

test('Buffer 输入与字符串输入等价', (t) => {
  const Cipher = loadCipher();
  const plain = 'buffer-input-sample';
  const encFromStr = Cipher.cipher(plain);
  const encFromBuf = Cipher.cipher(Buffer.from(plain, 'utf8'));

  t.is(encFromBuf, encFromStr);
  t.is(Cipher.decipher(encFromBuf), plain);
});