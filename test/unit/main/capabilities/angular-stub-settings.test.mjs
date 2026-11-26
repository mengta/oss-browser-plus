'use strict';

// 登录回归：oss2 prepaireOptions 调用 settingsSvs.connectTimeout.get()
import test from 'ava';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

test('settingsSvs.connectTimeout.get() 可用且为默认 30000', (t) => {
  const { angularStub } = require('../../../../node/capabilities/angular-stub.js');
  const settingsSvs = angularStub().resolve('settingsSvs');
  t.is(typeof settingsSvs.connectTimeout.get, 'function');
  t.is(settingsSvs.connectTimeout.get(), 30000);
});