'use strict';

// address-bar 基线单测（源 app/main/files/_/address-bar.js）
// $scope/$translate/Fav/AuthInfo/Toast/settingsSvs 为替身 DI；
// 重点覆盖 His 前进后退与上限裁剪、getAddress 归一化、goUp 路径回退。

import test from 'ava';
import { stubAngular } from '../../../../helpers/angular-stub.js';
import { stubLocalStorage } from '../../../../helpers/env-stubs.js';
import { installLegacyCrypto } from '../../../../helpers/crypto-legacy.js';

function setup(options) {
  installLegacyCrypto();
  stubLocalStorage({ 'auth-info': null });
  const reg = stubAngular();
  reg.services.$q = {
    defer() {
      return { promise: {}, resolve() {}, reject() {} };
    },
  };
  reg.load('app/const.js');
  reg.load('app/components/services/cipher.js');
  reg.load('app/components/services/authinfo.js');
  const AuthInfo = reg.get('AuthInfo');

  const scope = {
    _emitted: [],
    $emit(name, a, b) {
      scope._emitted.push({ name, a, b });
    },
    $on(name, fn) {
      (scope._handlers = scope._handlers || {})[name] = fn;
    },
  };
  const favSet = new Set((options && options.favs) || []);
  const locals = {
    $scope: scope,
    $translate: {
      instant(key) {
        return key;
      },
    },
    Fav: {
      has(addr) {
        return favSet.has(addr);
      },
      add(addr) {
        favSet.add(addr);
        return true;
      },
      remove(addr) {
        return favSet.delete(addr);
      },
    },
    AuthInfo,
    Toast: {
      success() {},
      warn() {},
    },
    settingsSvs: {
      historiesLength: {
        get() {
          return (options && options.hisMax) || 100;
        },
      },
    },
  };
  reg.load('app/main/files/_/address-bar.js');
  reg.invokeController('addressBarCtrl', locals);
  return { scope, AuthInfo, locals, reg };
}

test('初始地址取 AuthInfo.get().osspath，缺省回退 oss://', (t) => {
  const s = setup();
  t.is(s.scope.address, 'oss://');

  s.AuthInfo.save({ id: 'x', osspath: 'oss://bucket-a/path/' });
  const scope2 = {
    _emitted: [],
    $emit() {},
    $on() {},
  };
  s.reg.invokeController('addressBarCtrl', Object.assign({}, s.locals, { $scope: scope2 }));
  t.is(scope2.address, 'oss://bucket-a/path/');
});

test('His 前进后退：后退返回上一地址，前进返回下一地址', (t) => {
  const { scope } = setup();

  scope.address = 'oss://b/p1/';
  scope.go();
  scope.address = 'oss://b/p1/p2/';
  scope.go();

  t.true(scope.canGoBack);
  t.false(scope.canGoAhead);

  scope.goBack();
  t.is(scope.address, 'oss://b/p1/');
  t.is(scope._emitted.at(-1).name, 'ossAddressChange');

  scope.goAhead();
  t.is(scope.address, 'oss://b/p1/p2/');
});

test('His 上限裁剪：超过 historiesLength 时丢弃新记录，保留最初 MAX 条', (t) => {
  const { scope } = setup({ hisMax: 3 });

  for (let i = 1; i <= 5; i++) {
    scope.address = 'oss://b/p' + i + '/';
    scope.go();
  }

  t.true(scope.canGoBack);
  scope.goBack();
  t.is(scope.address, 'oss://b/p2/');
  scope.goBack();
  t.is(scope.address, 'oss://b/p1/');
  scope.goBack();
  t.is(scope.address, 'oss://b/p1/');
  t.false(scope.canGoBack);
});

test('His.add 连续重复地址不新增记录', (t) => {
  const { scope } = setup();

  scope.address = 'oss://b/p1/';
  scope.go();
  const count = scope._emitted.length;
  scope.go();

  t.is(scope._emitted.length, count + 1);
  scope.goBack();
  t.is(scope.address, 'oss://b/p1/');
});

test('getAddress 归一化：补 oss:// 前缀与尾部斜杠', (t) => {
  const { scope } = setup();

  scope.address = 'bucket-a/path';
  scope.go();
  t.is(scope.address, 'oss://bucket-a/path/');
  t.is(scope._emitted.at(-1).a, 'oss://bucket-a/path/');
});

test('getAddress 空值与裸前缀保持 oss://', (t) => {
  const { scope } = setup();

  scope.address = '';
  scope.go();
  t.is(scope.address, 'oss://');

  scope.address = 'oss://';
  scope.go();
  t.is(scope.address, 'oss://');
});

test('goUp 逐级回退路径并在根级回到 oss://', (t) => {
  const { scope } = setup();

  scope.address = 'oss://bucket-a/p1/p2/file.txt';
  scope.go();

  scope.goUp();
  t.is(scope.address, 'oss://bucket-a/p1/p2/');
  scope.goUp();
  t.is(scope.address, 'oss://bucket-a/p1/');
  scope.goUp();
  t.is(scope.address, 'oss://bucket-a/');
  scope.goUp();
  t.is(scope.address, 'oss://');
});

test('toggleFav 增删书签并 Toast 提示', (t) => {
  const { scope } = setup();

  t.false(scope.isFav('oss://b/p1/'));
  scope.toggleFav('oss://b/p1/');
  t.true(scope.isFav('oss://b/p1/'));
  scope.toggleFav('oss://b/p1/');
  t.false(scope.isFav('oss://b/p1/'));
});

test('saveDefaultAddress 持久化到 AuthInfo 并 Toast 成功', (t) => {
  const { scope, AuthInfo } = setup();

  scope.address = 'oss://bucket-x/home/';
  scope.saveDefaultAddress();

  t.is(AuthInfo.get().address, 'oss://bucket-x/home/');
});

test('getDefaultAddress 优先 osspath 其次 address 最后 oss://', (t) => {
  const { scope, AuthInfo } = setup();

  t.is(scope.getDefaultAddress(), 'oss://');
  AuthInfo.saveToAuthInfo({ address: 'oss://bucket-a/' });
  t.is(scope.getDefaultAddress(), 'oss://bucket-a/');
  AuthInfo.saveToAuthInfo({ osspath: 'oss://bucket-a/dir/' });
  t.is(scope.getDefaultAddress(), 'oss://bucket-a/dir/');
});

test('filesViewReady 后触发 goHome 并响应 goToOssAddress 事件', (t) => {
  const { scope } = setup();

  scope._handlers.filesViewReady();

  t.is(scope._emitted.filter((e) => e.name === 'ossAddressChange').length, 1);

  scope._handlers.goToOssAddress({}, 'oss://bucket-b/dir2/');
  t.is(scope.address, 'oss://bucket-b/dir2/');
  t.is(scope._emitted.at(-1).a, 'oss://bucket-b/dir2/');
});