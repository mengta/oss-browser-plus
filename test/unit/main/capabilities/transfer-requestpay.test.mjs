'use strict';

// P6c（T-P6c-05）：applyRequestPay 返回 ctx 语义，不再写 global.localStorage。
import test from 'ava';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const transfer = require('../../../../node/capabilities/transfer.js');

test('applyRequestPay：YES/NO 仅返回开关，不写全局 localStorage', (t) => {
  t.is(transfer.api.applyRequestPay({ requestpaystatus: 'YES' }), 'YES');
  t.is(transfer.api.applyRequestPay({ requestpaystatus: 'NO' }), 'NO');
  t.is(transfer.api.applyRequestPay({}), 'NO', '缺省按关闭处理（与登录页默认一致）');
  t.is(typeof global.localStorage, 'undefined');
});