'use strict';

// 请求者付费：渲染层 auth.requestpaystatus → 主进程 ossstore 依赖的 localStorage 开关（B5 bugfix）
import test from 'ava';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../../helpers/env-stubs.js';

const require = createRequire(import.meta.url);

function load() {
  stubLocalStorage({});
  return require('../../../../node/capabilities/transfer.js');
}

test('applyRequestPay：YES/NO 写入主进程 localStorage 并回读一致', (t) => {
  const transfer = load().api;
  t.is(transfer.applyRequestPay({ requestpaystatus: 'YES' }), 'YES');
  t.is(global.localStorage.getItem('show-request-pay'), 'YES');

  t.is(transfer.applyRequestPay({ requestpaystatus: 'NO' }), 'NO');
  t.is(global.localStorage.getItem('show-request-pay'), 'NO');

  t.is(transfer.applyRequestPay({}), 'NO', '缺省按关闭处理（与登录页默认一致）');
});