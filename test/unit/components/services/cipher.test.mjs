'use strict';

// cipher.js 基线单测（源 app/components/services/cipher.js）
// R-14 密文锚点：aes192 + 默认 key 'x82m#*lx8vv' 的固定明文→固定密文映射，
// 升级后（P2 createCipheriv 改造）必须保持该锚点一致，否则存量登录态丢失。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { installLegacyCrypto } from '../../../helpers/crypto-legacy.js';

const KEY = 'x82m#*lx8vv';
// 升级后一致性比对锚点：createCipher(aes192) 旧 API 输出（EVP_BytesToKey MD5 无盐单轮派生）
// 权威来源：Electron 1.8.4（内置 Node 8.2.1）旧 createCipher 实测输出，2026-11-14
const ANCHOR_PLAIN = 'oss-browser-anchor-2026';
const ANCHOR_CIPHER_HEX =
  'b3bdfaf3ea17bbb93edc996b5e3cd1c06c388187cc904886186a26b0d44f18c0';

function loadCipher() {
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

test('固定明文样本输出固定密文样本（升级后一致性比对锚点）', (t) => {
  const Cipher = loadCipher();
  const encrypted = Cipher.cipher(ANCHOR_PLAIN);

  // 锚点注释：升级后 createCipheriv 等价改造必须使本断言保持通过
  t.is(encrypted, ANCHOR_CIPHER_HEX);
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