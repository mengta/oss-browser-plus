'use strict';

// settings mailSmtp 单测（源 app/components/services/settings.js mailSmtp 成员，CS-02 / T-CS-06）
// 覆盖：set 后 v2 密文无密码明文 / v0 明文预置迁移逐字段回读（6.3-3）/
// 损坏密文回退默认不抛异常（D-11）/ 无存量默认 465 / set-get 往返 /
// 兄弟成员（排除键）行为零变化抽验（5.1.1-规则 2）。

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
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/safe-storage-client.js');
  reg.load('app/components/services/secure-store.js');
  reg.load('app/components/services/settings.js');

  t.teardown(() => {
    unstubAll();
    restoreEnv();
  });

  return { reg, storage, svs: reg.get('settingsSvs') };
}

test.serial('set 后 mailSender 值带 enc:v2: 前缀且不含密码明文', (t) => {
  const ctx = setup(t);
  ctx.svs.mailSmtp.set({
    host: 'smtp.example.com',
    port: 465,
    auth: { user: 'u1', pass: 'p1' },
  });

  const raw = ctx.storage.getItem('mailSender');
  t.true(raw.indexOf('enc:v2:') === 0);
  t.false(raw.includes('p1'));
  t.false(raw.includes('smtp.example.com'));
});

test.serial('预置 v0 明文 JSON：get 逐字段回读一致且存储已迁移', (t) => {
  const preset = { host: 'h1', port: 465, auth: { user: 'u1', pass: 'p1' } };
  const ctx = setup(t, { mailSender: JSON.stringify(preset) });

  t.deepEqual(ctx.svs.mailSmtp.get(), preset);
  t.true(ctx.storage.getItem('mailSender').indexOf('enc:v2:') === 0);
});

test.serial('预置损坏密文：get 返回默认对象且不抛异常（D-11）', (t) => {
  const ctx = setup(t, { mailSender: 'enc:v2:garbage!!' });

  let result = null;
  let err = null;
  try {
    result = ctx.svs.mailSmtp.get();
  } catch (e) {
    err = e;
  }

  t.is(err, null);
  t.deepEqual(result, { port: 465 });
  t.is(ctx.storage.getItem('mailSender'), 'enc:v2:garbage!!');
});

test.serial('无存量数据：get 返回默认对象（端口 465，6.3-2）', (t) => {
  const ctx = setup(t);

  t.deepEqual(ctx.svs.mailSmtp.get(), { port: 465 });
});

test.serial('set→get 往返一致', (t) => {
  const ctx = setup(t);
  const cfg = { host: 'smtp2.example.com', port: 587, auth: { user: 'u2', pass: 'p2' } };

  ctx.svs.mailSmtp.set(cfg);
  t.deepEqual(ctx.svs.mailSmtp.get(), cfg);
});

test.serial('兄弟成员行为不变抽验（排除键零格式变化）', (t) => {
  const ctx = setup(t);

  t.is(ctx.svs.autoUpgrade.get(), 1);

  ctx.svs.autoUpgrade.set(0);
  t.is(ctx.storage.getItem('autoUpgrade'), '0');
  t.is(ctx.svs.autoUpgrade.get(), 0);

  ctx.svs.historiesLength.set(50);
  t.is(ctx.storage.getItem('historiesLength'), '50');
  t.is(ctx.svs.historiesLength.get(), 50);
});