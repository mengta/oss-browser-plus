'use strict';

// 传输域回归：pause/resume 等按 taskId 定位的方法不能被注入 auth 作为首参
import test from 'ava';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../../helpers/env-stubs.js';

const require = createRequire(import.meta.url);

function load() {
  stubLocalStorage({});
  return require('../../../../node/capabilities/dispatch.js');
}

const auth = { accessKeyId: 'LTAI-test', accessKeySecret: 'sk-test' };

test('transfer.resume：taskId 原样传递（不注入 auth 对象）', async (t) => {
  const { dispatch } = load();
  const err = await t.throwsAsync(() => dispatch('transfer', 'resume', auth, ['task-x']));
  t.is(err.code, 'NOT_FOUND');
  t.is(err.message, 'task task-x not found');
});

test('transfer.pause：taskId 原样传递（不注入 auth 对象）', async (t) => {
  const { dispatch } = load();
  const err = await t.throwsAsync(() => dispatch('transfer', 'pause', auth, ['task-x']));
  t.is(err.code, 'NOT_FOUND');
  t.is(err.message, 'task task-x not found');
});

test('transfer.getTasks：无参调用返回任务数组', async (t) => {
  const { dispatch } = load();
  const out = await dispatch('transfer', 'getTasks', auth, []);
  t.true(Array.isArray(out));
});