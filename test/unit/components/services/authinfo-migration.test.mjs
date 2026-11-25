'use strict';

// authinfo 迁移单测（源 app/components/services/authinfo.js，CS-02 / T-CS-04）
// 覆盖：三键 v1 惰性迁移（auth-info/auth-his/auth-keep）/ save 写盘失败不落明文（D-9）/
// 损坏值行为与整改前一致（D-8，not-json-array 走损坏分支）/ addToHistories 读-改-写去重 /
// remember 往返 / remove / saveToAuthInfo 合并语义（6.2-4/6.2-5）。
// authinfo/const/cipher/secure-store 全真实实现，electron.safeStorage 为 on 态替身。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubLocalStorage, restoreEnv } from '../../../helpers/env-stubs.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';
import { createBridge } from '../../../helpers/bridge-stub.js';

function setup(t, initial) {
  const storage = stubLocalStorage(initial || {});
  stubModule('electron', {
    safeStorage: {
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
    },
  });
  createBridge();
  const reg = stubAngular();
  reg.load('app/const.js');
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/safe-storage-client.js');
  reg.load('app/components/services/secure-store.js');
  reg.services.$q = {};
  reg.load('app/components/services/authinfo.js');

  t.teardown(() => {
    unstubAll();
    restoreEnv();
  });

  return {
    reg,
    storage,
    AuthInfo: reg.get('AuthInfo'),
    Cipher: reg.get('Cipher'),
  };
}

test.serial('auth-info v1 密文：get 返回对象且存储已迁移为 v2', (t) => {
  const ctx = setup(t);
  ctx.storage.setItem(
    'auth-info',
    ctx.Cipher.cipher(JSON.stringify({ id: 'ak1', secret: 'sk1' }))
  );

  t.deepEqual(ctx.AuthInfo.get(), { id: 'ak1', secret: 'sk1' });
  t.true(ctx.storage.getItem('auth-info').indexOf('enc:v2:') === 0);
  t.false(ctx.storage.getItem('auth-info').includes('ak1'));
});

test.serial('auth-his v1 密文：listHistories 迁移读取', (t) => {
  const ctx = setup(t);
  ctx.storage.setItem(
    'auth-his',
    ctx.Cipher.cipher(JSON.stringify([{ id: 'h1', secret: 's1' }]))
  );

  t.deepEqual(ctx.AuthInfo.listHistories(), [{ id: 'h1', secret: 's1' }]);
  t.true(ctx.storage.getItem('auth-his').indexOf('enc:v2:') === 0);
});

test.serial('auth-keep v1 密文：getRemember 迁移读取', (t) => {
  const ctx = setup(t);
  ctx.storage.setItem(
    'auth-keep',
    ctx.Cipher.cipher(JSON.stringify({ id: 'k1', secret: 'ks1' }))
  );

  t.deepEqual(ctx.AuthInfo.getRemember(), { id: 'k1', secret: 'ks1' });
  t.true(ctx.storage.getItem('auth-keep').indexOf('enc:v2:') === 0);
});

test.serial('save 写盘失败（setItem 抛错）：原值不变且无明文落盘（D-9）', (t) => {
  const ctx = setup(t);
  ctx.AuthInfo.save({ id: 'orig' });
  const before = ctx.storage.getItem('auth-info');
  t.true(before.indexOf('enc:v2:') === 0);

  const origSetItem = ctx.storage.setItem;
  ctx.storage.setItem = function (k, v) {
    if (k === 'auth-info') {
      throw new Error('quota exceeded');
    }
    return origSetItem.call(ctx.storage, k, v);
  };

  ctx.AuthInfo.save({ id: 'new-plain' });

  t.is(ctx.storage.getItem('auth-info'), before);
  t.false(ctx.storage.getItem('auth-info').includes('new-plain'));
});

test.serial('损坏值 not-json-array：行为与整改前一致（原值保留 + 返回默认）', (t) => {
  const ctx = setup(t, { 'auth-his': 'not-json-array' });

  t.deepEqual(ctx.AuthInfo.listHistories(), {});
  t.is(ctx.storage.getItem('auth-his'), 'not-json-array');
});

test.serial('迁移后 addToHistories 读-改-写不引入重复条目', (t) => {
  const ctx = setup(t);
  ctx.storage.setItem(
    'auth-his',
    ctx.Cipher.cipher(JSON.stringify([{ id: 'ak1', secret: 's1' }]))
  );

  ctx.AuthInfo.addToHistories({ id: 'ak1', secret: 's1-new' });
  const arr = ctx.AuthInfo.listHistories();

  t.is(arr.length, 1);
  t.is(arr[0].secret, 's1-new');
});

test.serial('remember/getRemember 往返（v2 写入）', (t) => {
  const ctx = setup(t);
  ctx.AuthInfo.remember({ id: 'ak2', secret: 'sk2' });

  t.true(ctx.storage.getItem('auth-keep').indexOf('enc:v2:') === 0);
  t.false(ctx.storage.getItem('auth-keep').includes('sk2'));
  t.deepEqual(ctx.AuthInfo.getRemember(), { id: 'ak2', secret: 'sk2' });
});

test.serial('remove 后键不存在', (t) => {
  const ctx = setup(t);
  ctx.AuthInfo.save({ id: 'x' });
  ctx.AuthInfo.remove();

  t.is(ctx.storage.getItem('auth-info'), null);
});

test.serial('saveToAuthInfo 合并语义保持', (t) => {
  const ctx = setup(t);
  ctx.storage.setItem(
    'auth-info',
    ctx.Cipher.cipher(JSON.stringify({ id: 'a1', secret: 's1' }))
  );

  ctx.AuthInfo.saveToAuthInfo({ eptpl: 'http://x' });

  t.deepEqual(ctx.AuthInfo.get(), {
    id: 'a1',
    secret: 's1',
    eptpl: 'http://x',
  });
});