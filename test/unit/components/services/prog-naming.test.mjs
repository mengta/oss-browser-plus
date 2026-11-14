'use strict';

// prog-naming 单测（源 app/components/services/prog-naming.js）
// 覆盖 credential-security design I-4 / D-6 契约：
// 脱敏（不含 AK 明文）/ sha256 确定性 / 不同 AK 不碰撞 / 空 AK 确定输出 /
// legacy 形式与现状拼接一致 / up-down 双前缀 / 16 hex 结构 / angular-stub 可加载。

import test from 'ava';
import nodeCrypto from 'node:crypto';
import { stubAngular } from '../../../helpers/angular-stub.js';

function loadProgNaming() {
  const reg = stubAngular();
  reg.load('app/components/services/prog-naming.js');
  return reg.get('ProgNaming');
}

test('脱敏命名不含 AccessKeyId 明文', (t) => {
  const ProgNaming = loadProgNaming();
  const name = ProgNaming.newProgFileName('upprog_', 'LTAI5tFakeAK123');

  t.false(name.includes('LTAI5tFakeAK123'));
  t.true(name.startsWith('upprog_'));
  t.true(name.endsWith('.json'));
});

test('同 (prefix, ak) 输入恒定输出（sha256 确定性）', (t) => {
  const ProgNaming = loadProgNaming();
  const a = ProgNaming.newProgFileName('downprog_', 'AK-SAMPLE-1');
  const b = ProgNaming.newProgFileName('downprog_', 'AK-SAMPLE-1');

  t.is(a, b);
});

test('两个不同 ak 输出不同文件名（无碰撞）', (t) => {
  const ProgNaming = loadProgNaming();
  const a = ProgNaming.newProgFileName('upprog_', 'AK-AAA');
  const b = ProgNaming.newProgFileName('upprog_', 'AK-BBB');

  t.not(a, b);
});

test('空 ak 有确定输出（sha256 空串截断，语义与现状对齐且无明文泄露）', (t) => {
  const ProgNaming = loadProgNaming();
  const expected =
    'upprog_' + nodeCrypto.createHash('sha256').update('', 'utf8').digest('hex').slice(0, 16) + '.json';

  t.is(ProgNaming.newProgFileName('upprog_', ''), expected);
  t.is(ProgNaming.newProgFileName('upprog_', ''), ProgNaming.newProgFileName('upprog_', ''));
  t.is(ProgNaming.newProgFileName('upprog_', null), expected);
});

test('legacy 形式与现状拼接完全一致（仅供迁移探测与补删）', (t) => {
  const ProgNaming = loadProgNaming();

  t.is(ProgNaming.legacyProgFileName('upprog_', 'LTAI5tFakeAK123'), 'upprog_LTAI5tFakeAK123.json');
  t.is(ProgNaming.legacyProgFileName('downprog_', 'AK9'), 'downprog_AK9.json');
  t.is(ProgNaming.legacyProgFileName('upprog_', ''), 'upprog_.json');
});

test('up/down 双前缀各自正确', (t) => {
  const ProgNaming = loadProgNaming();
  const up = ProgNaming.newProgFileName('upprog_', 'AK-X');
  const down = ProgNaming.newProgFileName('downprog_', 'AK-X');

  t.true(up.startsWith('upprog_'));
  t.true(down.startsWith('downprog_'));
  t.not(up, down);
});

test('输出恒为 16 位 hex + .json 结构', (t) => {
  const ProgNaming = loadProgNaming();

  t.regex(ProgNaming.newProgFileName('upprog_', 'AK-STRUCT'), /^upprog_[0-9a-f]{16}\.json$/);
  t.regex(ProgNaming.newProgFileName('downprog_', ''), /^downprog_[0-9a-f]{16}\.json$/);
});

test('Angular 服务可经 angular-stub 加载且导出双方法', (t) => {
  const ProgNaming = loadProgNaming();

  t.is(typeof ProgNaming.newProgFileName, 'function');
  t.is(typeof ProgNaming.legacyProgFileName, 'function');
});