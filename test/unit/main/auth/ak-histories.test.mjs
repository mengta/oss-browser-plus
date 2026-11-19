'use strict';

// ak-histories 基线单测（源 app/main/auth/ak-histories.js，历史管理载体 app/components/services/authinfo.js）
// authinfo/const/cipher 为真实实现，$q/$uibModalInstance/$translate/Dialog/Toast 为替身 DI。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubLocalStorage } from '../../../helpers/env-stubs.js';
import { stubModule } from '../../../helpers/module-stubs.js';
import { installLegacyCrypto } from '../../../helpers/crypto-legacy.js';

function setup() {
  installLegacyCrypto();
  const storage = stubLocalStorage();
  const clipboard = {
    text: '',
    writeText(v) {
      clipboard.text = v;
    },
  };
  stubModule('electron', {
    clipboard,
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
  const reg = stubAngular();
  reg.load('app/const.js');
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/safe-storage-client.js');
  reg.load('app/components/services/secure-store.js');
  reg.services.$q = {
    defer() {
      const df = {};
      df.promise = {
        then(fn, errFn) {
          df._then = fn;
          df._errFn = errFn;
          return df.promise;
        },
      };
      df.resolve = (v) => { df._then && df._then(v); };
      df.reject = (e) => { df._errFn && df._errFn(e); };
      return df;
    },
  };
  reg.load('app/components/services/authinfo.js');
  const AuthInfo = reg.get('AuthInfo');
  return { reg, storage, AuthInfo, clipboard };
}

function createController(ctx, overrides) {
  const { reg, AuthInfo } = ctx;
  const calls = { dismiss: [], onUse: [], toast: [], confirm: [] };
  const T = (key) => (key === 'region.oss-cn-hangzhou' ? '华东1(杭州)' : key);
  const locals = Object.assign(
    {
      $scope: {},
      $uibModalInstance: {
        dismiss(reason) {
          calls.dismiss.push(reason);
        },
      },
      $translate: { instant: T },
      AuthInfo,
      Dialog: {
        confirm(title, msg, fn, cls) {
          calls.confirm.push({ title, msg, cls });
          return fn(true);
        },
      },
      Toast: {
        success(msg) {
          calls.toast.push(msg);
        },
        warn(msg) {
          calls.toast.push(msg);
        },
      },
      onUse(h) {
        calls.onUse.push(h);
      },
    },
    overrides || {}
  );
  reg.load('app/main/auth/ak-histories.js');
  reg.invokeController('akHistoriesCtrl', locals);
  return { scope: locals.$scope, calls, AuthInfo };
}

test.beforeEach(() => {
  // localStorage 已在 setup 中替换；本文件用例独立 storage 实例
});

test('初始加载时从 AuthInfo.listHistories 填充 $scope.his（数组守卫）', (t) => {
  const ctx = setup();
  ctx.AuthInfo.addToHistories({ id: 'ak1', secret: 's1', region: 'oss-cn-hangzhou' });
  const { scope } = createController(ctx);

  t.is(scope.his.length, 1);
  t.is(scope.his[0].id, 'ak1');
});

test('非数组历史数据时 $scope.his 回退为空数组', (t) => {
  const ctx = setup();
  ctx.storage.setItem('auth-his', 'not-json-array');
  const { scope } = createController(ctx);

  t.deepEqual(scope.his, []);
});

test('remove 确认后从历史中删除对应 AK', (t) => {
  const ctx = setup();
  ctx.AuthInfo.addToHistories({ id: 'ak1' });
  ctx.AuthInfo.addToHistories({ id: 'ak2' });
  const { scope, calls } = createController(ctx);

  scope.remove(scope.his.find((h) => h.id === 'ak2'));

  t.is(calls.confirm.length, 1);
  t.is(ctx.AuthInfo.listHistories().length, 1);
  t.is(ctx.AuthInfo.listHistories()[0].id, 'ak1');
  t.is(scope.his.length, 1);
});

test('remove 拒绝确认时不删除', (t) => {
  const ctx = setup();
  ctx.AuthInfo.addToHistories({ id: 'ak1' });
  const { scope } = createController(ctx, {
    Dialog: {
      confirm(title, msg, fn) {
        return fn(false);
      },
    },
  });

  scope.remove(scope.his[0]);

  t.is(ctx.AuthInfo.listHistories().length, 1);
});

test('cleanAll 确认后清空历史并 Toast 成功', (t) => {
  const ctx = setup();
  ctx.AuthInfo.addToHistories({ id: 'ak1' });
  ctx.AuthInfo.addToHistories({ id: 'ak2' });
  const { scope, calls } = createController(ctx);

  scope.cleanAll();

  t.deepEqual(Object.keys(ctx.AuthInfo.listHistories()), []);
  t.deepEqual(scope.his, []);
  t.is(calls.toast.length, 1);
});

test('regionText：无 region 返回 "-"，命中翻译返回译文，未命中返回原文', (t) => {
  const ctx = setup();
  const { scope } = createController(ctx);

  t.is(scope.regionText({}), '-');
  t.is(scope.regionText({ region: 'oss-cn-hangzhou' }), '华东1(杭州)');
  t.is(scope.regionText({ region: 'oss-cn-unknown' }), 'oss-cn-unknown');
});

test('toggleSecret 翻转 showSecrets 标记', (t) => {
  const ctx = setup();
  const { scope } = createController(ctx);
  const h = { id: 'ak1' };

  scope.toggleSecret(h);
  t.is(scope.showSecrets['ak1'], true);
  scope.toggleSecret(h);
  t.is(scope.showSecrets['ak1'], false);
});

test('use 调用 onUse 回调并关闭弹窗', (t) => {
  const ctx = setup();
  const { scope, calls } = createController(ctx);
  const h = { id: 'ak1' };

  scope.use(h);

  t.deepEqual(calls.onUse, [h]);
  t.deepEqual(calls.dismiss, ['close']);
});

test('cancel 关闭弹窗', (t) => {
  const ctx = setup();
  const { scope, calls } = createController(ctx);

  scope.cancel();

  t.deepEqual(calls.dismiss, ['close']);
});

test('copy 以 key:value 形式将所有非空 OSS 信息写入剪贴板并 Toast 成功', (t) => {
  const ctx = setup();
  const { scope, calls } = createController(ctx);
  const h = {
    id: 'ak1',
    secret: 'sec1',
    stoken: 'sts1',
    region: 'oss-cn-hangzhou',
    eptpl: 'https://oss-cn-hangzhou.aliyuncs.com',
    osspath: 'oss://bucket/path/',
    desc: '备注信息',
  };

  scope.copy(h);

  t.is(
    ctx.clipboard.text,
    [
      'AccessKeyId: ak1',
      'AccessKeySecret: sec1',
      'STS Token: sts1',
      'Region: oss-cn-hangzhou',
      'Endpoint: https://oss-cn-hangzhou.aliyuncs.com',
      'Preset OSS Path: oss://bucket/path/',
      'Description: 备注信息',
    ].join('\n')
  );
  t.deepEqual(calls.toast, ['copy.successfully']);
});

test('copy 跳过空字段，Endpoint 优先级为 eptplcname > privateLink > eptpl', (t) => {
  const ctx = setup();
  const { scope } = createController(ctx);

  scope.copy({
    id: 'ak2',
    eptpl: 'https://{region}.aliyuncs.com',
    privateLink: 'https://oss-cn-hangzhou-internal.aliyuncs.com',
    eptplcname: 'https://custom.example.com',
  });
  t.is(
    ctx.clipboard.text,
    [
      'AccessKeyId: ak2',
      'Endpoint: https://custom.example.com',
    ].join('\n')
  );

  scope.copy({ id: 'ak3', privateLink: 'https://oss-cn-hangzhou-internal.aliyuncs.com' });
  t.is(
    ctx.clipboard.text,
    ['AccessKeyId: ak3', 'Endpoint: https://oss-cn-hangzhou-internal.aliyuncs.com'].join('\n')
  );
});

test('历史持久化经 SecureStore v2 加密写入 localStorage（密文异于明文）', (t) => {
  const ctx = setup();
  ctx.AuthInfo.addToHistories({ id: 'ak9', secret: 'sec-9' });
  const raw = ctx.storage.getItem('auth-his');

  t.truthy(raw);
  t.false(raw.includes('ak9'));
  t.true(raw.indexOf('enc:v2:') === 0);
});