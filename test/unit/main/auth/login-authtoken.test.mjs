'use strict';

// login authToken 单测（源 app/main/auth/login.js :107/:175 两点，CS-02 / T-CS-05）
// 覆盖：防抖 flush 后 v2 密文非明文 / 空串直写（D-10）/ v0 明文预置迁移 /
// authTokenInfo 内存态解析不受影响（子用户 AK 分支，避开 moment 依赖）/
// 多次触发防抖去抖仅最后一次生效。
// $timeout 为可控 flush 替身（pending 队列 + cancel 标记），authinfo/secure-store 全真实实现。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubLocalStorage, restoreEnv } from '../../../helpers/env-stubs.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';

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
  const reg = stubAngular();
  reg.load('app/const.js');
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/safe-storage-client.js');
  reg.load('app/components/services/secure-store.js');
  reg.services.$q = {};
  reg.load('app/components/services/authinfo.js');

  const pending = [];
  const $timeout = function (fn) {
    const h = { fn, cancelled: false };
    pending.push(h);
    return h;
  };
  $timeout.cancel = function (h) {
    if (h) {
      h.cancelled = true;
    }
  };
  const flush = function () {
    const run = pending.splice(0, pending.length);
    run.forEach((h) => {
      if (!h.cancelled) {
        h.fn();
      }
    });
  };

  const scope = { $watch() {} };
  const locals = {
    $scope: scope,
    $rootScope: {},
    $translate: { instant: (k) => k },
    Auth: {},
    AuthInfo: reg.get('AuthInfo'),
    $timeout,
    $location: {},
    Const: reg.get('Const'),
    Toast: { success() {}, warn() {}, error() {} },
    $uibModal: { open() { return { result: { then() {} } }; } },
    SecureStore: reg.get('SecureStore'),
  };

  reg.load('app/main/auth/login.js');
  reg.invokeController('loginCtrl', locals);

  t.teardown(() => {
    unstubAll();
    restoreEnv();
  });

  return { reg, storage, scope, flush };
}

test.serial('authTokenChange 防抖 flush 后 key-authtoken 为 v2 密文非明文', (t) => {
  const ctx = setup(t);
  ctx.scope.item.authToken = 'token-plain-1';
  ctx.scope.authTokenChange();
  ctx.flush();

  const raw = ctx.storage.getItem('key-authtoken');
  t.true(raw.indexOf('enc:v2:') === 0);
  t.false(raw.includes('token-plain-1'));
});

test.serial('空串场景直写空串（空值语义保持，D-10）', (t) => {
  const ctx = setup(t);
  ctx.scope.item.authToken = '';
  ctx.scope.authTokenChange();
  ctx.flush();

  t.is(ctx.storage.getItem('key-authtoken'), '');
});

test.serial('预置 v0 明文：init 读取回填一致且存储已迁移为 v2', (t) => {
  const ctx = setup(t, { 'key-authtoken': 'plain-token-v0' });

  t.is(ctx.scope.item.authToken, 'plain-token-v0');
  t.true(ctx.storage.getItem('key-authtoken').indexOf('enc:v2:') === 0);
});

test.serial('init 回填后 authTokenInfo 解析正常（内存态解析不受影响）', (t) => {
  const info = { id: 'LTAI5tsub', secret: 'sub-secret' };
  const token = Buffer.from(JSON.stringify(info)).toString('base64');
  const ctx = setup(t, { 'key-authtoken': token });
  ctx.flush();

  t.is(ctx.scope.item.authToken, token);
  t.truthy(ctx.scope.authTokenInfo);
  t.is(ctx.scope.authTokenInfo.id, 'LTAI5tsub');
  t.is(ctx.scope.authTokenInfo.secret, 'sub-secret');
});

test.serial('authTokenChange 多次触发防抖去抖：仅最后一次生效', (t) => {
  const ctx = setup(t);
  ctx.scope.item.authToken = 'token-A';
  ctx.scope.authTokenChange();
  ctx.scope.item.authToken = 'token-B';
  ctx.scope.authTokenChange();
  ctx.scope.item.authToken = 'token-C';
  ctx.scope.authTokenChange();
  ctx.flush();

  const raw = ctx.storage.getItem('key-authtoken');
  t.true(raw.indexOf('enc:v2:') === 0);
  t.false(raw.includes('token-A'));
  t.false(raw.includes('token-B'));
  t.is(ctx.reg.get('SecureStore').get('key-authtoken', ''), 'token-C');
});