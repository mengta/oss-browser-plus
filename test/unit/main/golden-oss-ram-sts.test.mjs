'use strict';

// A-07（P6a · R-P6-01/R-P6-06）：STS golden —— 4 态（成功/凭据无效/无权限/网络）code+message 与改造前等价。
// 通过替换 adapter.STS 注入假客户端（sts.js 与测试共享同一模块实例）。
import test from 'ava';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const adapter = require('../../../node/capabilities/sdk/aliyun-sdk-adapter.js');
const { assumeRole } = require('../../../node/capabilities/services/sts.js');

const realSTS = adapter.STS;
const ctx = { auth: { id: 'LTAI-test', secret: 'sk-test' } };

function stubSTS(handler) {
  adapter.STS = function FakeSTS(options) {
    this.options = options;
  };
  adapter.STS.prototype.assumeRole = function (request, cb) {
    handler(request, cb);
  };
}

test.afterEach.always(() => {
  adapter.STS = realSTS;
});

test('成功：返回 Credentials 且透传 RoleArn/DurationSeconds', async (t) => {
  let seen = null;
  stubSTS((request, cb) => {
    seen = request;
    cb(null, { Credentials: { AccessKeyId: 'STS.ak', AccessKeySecret: 'sk', SecurityToken: 'tok' } });
  });
  const result = await assumeRole(ctx, 'acs:ram::1:role/r', '{}', 900);
  t.is(result.Credentials.SecurityToken, 'tok');
  t.is(seen.RoleArn, 'acs:ram::1:role/r');
  t.is(seen.DurationSeconds, 900);
  t.is(seen.RoleSessionName, 'oss-browser');
});

test('凭据无效：保留 InvalidAccessKeyId code（渲染层据此回登录）', async (t) => {
  stubSTS((request, cb) => {
    cb({ code: 'InvalidAccessKeyId', message: 'bad key' });
  });
  const err = await t.throwsAsync(() => assumeRole(ctx, 'acs:ram::1:role/r', '{}', 900));
  t.is(err.code, 'InvalidAccessKeyId');
  t.is(err.message, 'bad key');
});

test('无权限：归一化为 Error + 没有权限前缀（与改造前一致）', async (t) => {
  stubSTS((request, cb) => {
    cb({ code: 'Forbidden', message: 'You are not authorized to do this action.' });
  });
  const err = await t.throwsAsync(() => assumeRole(ctx, 'acs:ram::1:role/r', '{}', 900));
  t.is(err.code, 'Forbidden');
  t.is(err.message, '没有权限, You are not authorized to do this action.');
});

test('网络错误：无 code 且 Failed to fetch → Error/无法连接', async (t) => {
  stubSTS((request, cb) => {
    cb({ message: 'Failed to fetch' });
  });
  const err = await t.throwsAsync(() => assumeRole(ctx, 'acs:ram::1:role/r', '{}', 900));
  t.is(err.code, 'Error');
  t.is(err.message, '无法连接');
});

test('缺少 roleArn：INVALID_ARG', async (t) => {
  stubSTS((request, cb) => cb(null, {}));
  const err = await t.throwsAsync(() => assumeRole(ctx, '', '{}', 900));
  t.is(err.code, 'INVALID_ARG');
});

test('缺少凭证：InvalidAccessKeyId（不调用 SDK）', async (t) => {
  let called = false;
  stubSTS((request, cb) => {
    called = true;
    cb(null, {});
  });
  const err = await t.throwsAsync(() => assumeRole({ auth: {} }, 'acs:ram::1:role/r', '{}', 900));
  t.is(err.code, 'InvalidAccessKeyId');
  t.false(called);
});