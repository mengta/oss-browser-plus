'use strict';

// secure-store 单测（源 app/components/services/secure-store.js + safe-storage-client.js）
// 覆盖 credential-security design 2.4.1-（4）八组行为：
// ① v2 加解密往返 ② 同明文两次 encrypt 密文互异（随机 IV）③ 格式判定四态
// ④ DEK 生命周期（p 态/d 态/缺失；降级重建；d 态重保护）⑤ 跨实例密文互不可解
// ⑥ 降级路径（v2d + onDegrade 一次性）⑦ 迁移三态（v1 迁移/写回失败保留/损坏默认）
// ⑧ 异常与回调（throw 态不炸；onSaveError 含键名）。
// 替身：stubModule('electron', { safeStorage: FakeSafeStorage }) 三态 on/off/throw，
// fake 以实例级随机 secret 模拟 OS 级密钥绑定（跨实例 protect 互异）。
// 全部 test.serial：module-stubs 的 saved 栈为模块级，串行保证恢复确定性。

import test from 'ava';
import nodeCrypto from 'node:crypto';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubLocalStorage, restoreEnv } from '../../../helpers/env-stubs.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';
import { createBridge } from '../../../helpers/bridge-stub.js';

const V2_PREFIX = 'enc:v2:';
const V2D_PREFIX = 'enc:v2d:';
const DEK_SLOT = 'enc-dek';

function makeFakeSafeStorage(state) {
  const secret = nodeCrypto.randomBytes(16).toString('hex');
  return {
    isEncryptionAvailable() {
      return state === 'on' || state === 'throw';
    },
    encryptString(s) {
      if (state === 'throw') { throw new Error('keychain locked'); }
      return Buffer.from(secret + '|' + s);
    },
    decryptString(buf) {
      if (state === 'throw') { throw new Error('keychain locked'); }
      const str = buf.toString('utf8');
      if (str.indexOf(secret + '|') !== 0) { throw new Error('not protected by this instance'); }
      return str.slice(secret.length + 1);
    },
  };
}

function gcmSeal(dek, plain, prefix) {
  const iv = nodeCrypto.randomBytes(12);
  const c = nodeCrypto.createCipheriv('aes-256-gcm', Buffer.from(dek), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return prefix + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

function setupSecureStore(t, opts) {
  const o = opts || {};
  const storage = stubLocalStorage(o.initial || {});
  const fake = makeFakeSafeStorage(o.state || 'on');
  stubModule('electron', { safeStorage: fake });
  createBridge();

  const reg = stubAngular();
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/safe-storage-client.js');
  reg.load('app/components/services/secure-store.js');

  t.teardown(() => {
    unstubAll();
    restoreEnv();
  });

  return { reg, storage, store: reg.get('SecureStore'), fake };
}

function makeBadV1Hex(Cipher) {
  for (let i = 0; i < 200; i++) {
    const s = nodeCrypto.randomBytes(24).toString('hex');
    try {
      Cipher.decipher(s);
    } catch (e) {
      return s;
    }
  }
  throw new Error('未能构造 decipher 必失败的 hex 样本');
}

test.serial('① v2 加解密往返：密文带 enc:v2: 前缀且 decrypt 还原', (t) => {
  const { store } = setupSecureStore(t, { state: 'on' });
  const enc = store.encrypt('oss-browser-凭证样本');

  t.true(enc.indexOf(V2_PREFIX) === 0);
  t.is(store.decrypt(enc), 'oss-browser-凭证样本');
});

test.serial('① get/set 往返：set 后 localStorage 值带前缀，get 还原', (t) => {
  const { store, storage } = setupSecureStore(t, { state: 'on' });

  t.true(store.set('auth-info', '{"id":"ak1"}'));
  t.true(storage.getItem('auth-info').indexOf(V2_PREFIX) === 0);
  t.false(storage.getItem('auth-info').includes('ak1'));
  t.is(store.get('auth-info', null), '{"id":"ak1"}');
});

test.serial('② 同一明文两次 encrypt 密文互异（随机 IV）', (t) => {
  const { store } = setupSecureStore(t, { state: 'on' });
  const a = store.encrypt('same-plain');
  const b = store.encrypt('same-plain');

  t.not(a, b);
  t.is(store.decrypt(a), 'same-plain');
  t.is(store.decrypt(b), 'same-plain');
});

test.serial('③ remove 后键不存在', (t) => {
  const { store, storage } = setupSecureStore(t, { state: 'on' });
  store.set('auth-keep', 'x');
  store.remove('auth-keep');

  t.is(storage.getItem('auth-keep'), null);
  t.is(store.get('auth-keep', 'fallback'), 'fallback');
});

test.serial('③ 损坏值：get 返回默认且原值保留（不阻断他键）', (t) => {
  const { reg, store, storage } = setupSecureStore(t, { state: 'on' });
  const bad = makeBadV1Hex(reg.get('Cipher'));

  storage.setItem('auth-his', bad);
  t.is(store.get('auth-his', 'DEF'), 'DEF');
  t.is(storage.getItem('auth-his'), bad);
});

test.serial('③ 非法格式值（not-json-array 类）非 legacyPlain：按损坏返回默认且原值保留', (t) => {
  const { store, storage } = setupSecureStore(t, {
    state: 'on',
    initial: { 'auth-his': 'not-json-array' },
  });

  t.is(store.get('auth-his', null), null);
  t.is(storage.getItem('auth-his'), 'not-json-array');
});

test.serial('③ v0 明文 legacyPlain：get 返回明文并迁移消灭 v0', (t) => {
  const { store, storage } = setupSecureStore(t, {
    state: 'on',
    initial: { mailSender: '{"port":465}' },
  });

  t.is(store.get('mailSender', null, { legacyPlain: true }), '{"port":465}');
  t.true(storage.getItem('mailSender').indexOf(V2_PREFIX) === 0);
});

test.serial('⑦ v1 密文：get 惰性迁移为 v2 且 localStorage 值更新', (t) => {
  const { reg, storage } = setupSecureStore(t, { state: 'on' });
  const Cipher = reg.get('Cipher');
  const v1 = Cipher.cipher('{"id":"LTAI5tv1sample"}');
  storage.setItem('auth-info', v1);

  const store = reg.get('SecureStore');
  t.is(store.get('auth-info', null), '{"id":"LTAI5tv1sample"}');
  t.true(storage.getItem('auth-info').indexOf(V2_PREFIX) === 0);
  t.not(storage.getItem('auth-info'), v1);
});

test.serial('⑦ v1 迁移写回失败（setItem 抛错）：原值保留且返回明文', (t) => {
  const { reg, storage } = setupSecureStore(t, { state: 'on' });
  const Cipher = reg.get('Cipher');
  const v1 = Cipher.cipher('migrate-fail-sample');
  storage.setItem('auth-info', v1);
  storage.setItem(DEK_SLOT, 'dek:d:' + nodeCrypto.randomBytes(32).toString('base64'));

  const origSetItem = storage.setItem;
  storage.setItem = function (k, v) {
    if (k === 'auth-info') { throw new Error('quota exceeded'); }
    return origSetItem.call(storage, k, v);
  };
  const store = reg.get('SecureStore');

  t.is(store.get('auth-info', null), 'migrate-fail-sample');
  t.is(storage.getItem('auth-info'), v1);
});

test.serial('④ DEK 槽 p 态装载：预置 DEK 的既有 v2 数据可读（装载正确非新建）', (t) => {
  const dek = nodeCrypto.randomBytes(32);
  const dekB64 = dek.toString('base64');
  const { storage, fake } = setupSecureStoreHelper(t, {
    state: 'on',
    initial: { 'auth-keep': gcmSeal(dek, 'p-slot-data', V2_PREFIX) },
  });

  storage.setItem(DEK_SLOT, 'dek:p:' + Buffer.from(fake.encryptString(dekB64)).toString('base64'));
  const { reg } = t.context;
  const store = reg.get('SecureStore');

  t.is(store.get('auth-keep', null), 'p-slot-data');
  t.true(storage.getItem(DEK_SLOT).indexOf('dek:p:') === 0);
});

test.serial('④ DEK 槽缺失：保护可用时新建并写 p 态槽', (t) => {
  const { store, storage } = setupSecureStore(t, { state: 'on' });

  store.set('auth-info', 'x');
  t.true(storage.getItem(DEK_SLOT).indexOf('dek:p:') === 0);
});

test.serial('④ DEK 槽 p 态 + release 失败（throw 态）：降级重建 d 态，旧 v2 数据按损坏处理', (t) => {
  const { store, storage } = setupSecureStore(t, {
    state: 'throw',
    initial: { 'auth-keep': 'enc:v2:' + Buffer.from('legacy-data-by-old-dek').toString('base64') },
  });
  // 初始预置的 p 态槽内容随意（throw 态下 release 必抛 → 内部 catch → null → 降级重建）
  storage.setItem(DEK_SLOT, 'dek:p:whatever');

  t.is(store.get('auth-keep', 'DEF'), 'DEF');
  t.true(storage.getItem(DEK_SLOT).indexOf('dek:d:') === 0);
});

test.serial('⑥ 降级（off 态）：encrypt 产出 enc:v2d: 且槽为 d 态', (t) => {
  const { store, storage } = setupSecureStore(t, { state: 'off' });
  const enc = store.encrypt('degraded-sample');

  t.true(enc.indexOf(V2D_PREFIX) === 0);
  t.is(store.decrypt(enc), 'degraded-sample');
  t.true(storage.getItem(DEK_SLOT).indexOf('dek:d:') === 0);
});

test.serial('⑥ 首次降级写入触发 onDegrade 一次，后续不重复', (t) => {
  const { store } = setupSecureStore(t, { state: 'off' });
  let count = 0;
  store.onDegrade(function () { count++; });

  store.set('auth-info', 'a');
  store.set('auth-info', 'b');

  t.is(count, 1);
});

test.serial('④ 场景 D：d 态槽 + 保护可用 → 重保护写回 p 态，既有 v2d 数据仍可解并机会升级', (t) => {
  const dek = nodeCrypto.randomBytes(32);
  const { reg, storage } = setupSecureStore(t, { state: 'off' });
  storage.setItem(DEK_SLOT, 'dek:d:' + dek.toString('base64'));

  const storeOff = reg.get('SecureStore');
  const enc2d = storeOff.encrypt('recover-sample');
  t.true(enc2d.indexOf(V2D_PREFIX) === 0);
  storage.setItem('auth-info', enc2d);

  unstubAll();
  restoreEnv();
  const round2 = setupSecureStore(t, {
    state: 'on',
    initial: {
      'enc-dek': 'dek:d:' + dek.toString('base64'),
      'auth-info': enc2d,
    },
  });

  t.is(round2.store.get('auth-info', null), 'recover-sample');
  t.true(round2.storage.getItem(DEK_SLOT).indexOf('dek:p:') === 0);
  t.true(round2.storage.getItem('auth-info').indexOf(V2_PREFIX) === 0);
});

test.serial('⑤ 跨实例互异：实例 A 密文在实例 B 下不可解（get 返回默认且原值保留）', (t) => {
  const a = setupSecureStore(t, { state: 'on' });
  const enc = a.store.encrypt('cross-instance-sample');

  unstubAll();
  restoreEnv();
  const b = setupSecureStore(t, { state: 'on', initial: { 'auth-info': enc } });

  t.is(b.store.get('auth-info', 'DEF'), 'DEF');
  t.is(b.storage.getItem('auth-info'), enc);
});

test.serial('⑧ throw 态（keychain 异常）：protect 失败不炸，DEK 走 d 态，加密往返仍可用', (t) => {
  const { store, storage } = setupSecureStore(t, { state: 'throw' });
  let err = null;
  try {
    const enc = store.encrypt('throw-state-sample');
    t.is(store.decrypt(enc), 'throw-state-sample');
  } catch (e) {
    err = e;
  }
  t.is(err, null);
  t.true(storage.getItem(DEK_SLOT).indexOf('dek:d:') === 0);
});

test.serial('⑧ onSaveError：写盘失败触发回调（含键名不含明文）且 set 返回 false', (t) => {
  const { reg, storage } = setupSecureStore(t, { state: 'on' });
  storage.setItem(DEK_SLOT, 'dek:d:' + nodeCrypto.randomBytes(32).toString('base64'));

  const origSetItem = storage.setItem;
  storage.setItem = function (k, v) {
    if (k === 'auth-info') { throw new Error('disk full'); }
    return origSetItem.call(storage, k, v);
  };

  const calls = [];
  const store = reg.get('SecureStore');
  store.onSaveError(function (key) { calls.push(key); });

  t.false(store.set('auth-info', 'plain-payload'));
  t.deepEqual(calls, ['auth-info']);
});

test.serial('⑦ v2d 机会升级失败（setItem 抛错）：原值保留且返回明文', (t) => {
  const dek = nodeCrypto.randomBytes(32);
  const { reg, storage } = setupSecureStore(t, { state: 'off' });
  storage.setItem(DEK_SLOT, 'dek:d:' + dek.toString('base64'));
  const storeOff = reg.get('SecureStore');
  const enc2d = storeOff.encrypt('upgrade-fail-sample');
  storage.setItem('auth-info', enc2d);

  unstubAll();
  restoreEnv();
  const round2 = setupSecureStore(t, {
    state: 'on',
    initial: { 'enc-dek': 'dek:d:' + dek.toString('base64'), 'auth-info': enc2d },
  });
  const origSetItem = round2.storage.setItem;
  round2.storage.setItem = function (k, v) {
    if (k === 'auth-info') { throw new Error('quota'); }
    return origSetItem.call(round2.storage, k, v);
  };

  t.is(round2.store.get('auth-info', null), 'upgrade-fail-sample');
  t.is(round2.storage.getItem('auth-info'), enc2d);
});

test.serial('⑧ 空/null 值：get 直返默认不迁移不建槽', (t) => {
  const { store, storage } = setupSecureStore(t, { state: 'on' });

  t.is(store.get('absent-key', 'DEF'), 'DEF');
  storage.setItem('empty-key', '');
  t.is(store.get('empty-key', 'DEF'), 'DEF');
  t.is(storage.getItem(DEK_SLOT), null);
});

function setupSecureStoreHelper(t, opts) {
  const ctx = setupSecureStore(t, opts);
  t.context = { reg: ctx.reg };
  return ctx;
}