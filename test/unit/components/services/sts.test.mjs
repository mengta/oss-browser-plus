'use strict';

// sts 基线单测（源 app/components/services/sts.js）
// aliyun-sdk（ALYD）以 module-stubs 注入替身（网络边界隔离）；
// 断言 assumeRole 请求组装（RoleArn/Policy/DurationSeconds/RoleSessionName）、
// handleError 分支（InvalidAccessKeyId 跳登录 / Failed to fetch 文案 / 无权限文案 / 普通 code 直传）。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';

function loadSts(options) {
  const calls = { assumeRole: [], toasts: [], stateGos: [] };
  const opts = Object.assign(
    {
      assumeRoleResult: null,
      assumeRoleErr: null,
    },
    options
  );
  const ALYD = {
    STS: class {
      constructor(cfg) {
        calls.clientConfig = cfg;
      }
      assumeRole(params, cb) {
        calls.assumeRole.push(params);
        if (opts.assumeRoleErr) {
          cb(opts.assumeRoleErr, null);
        } else {
          cb(null, opts.assumeRoleResult);
        }
      }
    },
  };
  stubModule('aliyun-sdk', ALYD);

  const reg = stubAngular();
  reg.services.$q = {
    defer() {
      let resolveFn;
      let rejectFn;
      const promise = new Promise((res, rej) => {
        resolveFn = res;
        rejectFn = rej;
      });
      return { promise, resolve: resolveFn, reject: rejectFn };
    },
  };
  reg.services.$state = {
    go(name) {
      calls.stateGos.push(name);
    },
  };
  reg.services.AuthInfo = {
    get() {
      return { id: 'LTAI-TEST', secret: 'SEC-TEST' };
    },
  };
  reg.services.Toast = {
    error(msg) {
      calls.toasts.push(msg);
    },
  };
  reg.services.Const = {
    AUTH_INFO_KEY: 'auth-info',
    AUTH_HIS: 'auth-his',
    AUTH_KEEP: 'auth-keep',
  };
  reg.load('app/components/services/sts.js');
  const stsSvs = reg.get('stsSvs');
  return { stsSvs, calls, cleanup: unstubAll };
}

test.afterEach(() => {
  unstubAll();
});

test('assumeRole 组装 AssumeRole 请求参数并透传结果', async (t) => {
  const { stsSvs, calls } = loadSts({ assumeRoleResult: { Credentials: {} } });

  await stsSvs.assumeRole('acs:ram::123:role/readonly', '{"Version":"1"}', 1200);

  t.is(calls.assumeRole.length, 1);
  const params = calls.assumeRole[0];
  t.is(params.Action, 'AssumeRole');
  t.is(params.RoleArn, 'acs:ram::123:role/readonly');
  t.is(params.Policy, '{"Version":"1"}');
  t.is(params.DurationSeconds, 1200);
  t.is(params.RoleSessionName, 'oss-browser');
  t.is(calls.clientConfig.accessKeyId, 'LTAI-TEST');
  t.is(calls.clientConfig.secretAccessKey, 'SEC-TEST');
  t.is(calls.clientConfig.endpoint, 'https://sts.aliyuncs.com');
});

test('assumeRole 缺省 DurationSeconds 默认 3600', async (t) => {
  const { stsSvs, calls } = loadSts({ assumeRoleResult: {} });

  await stsSvs.assumeRole('arn', null);

  t.is(calls.assumeRole[0].DurationSeconds, 3600);
});

test('assumeRole 失败时 reject 错误并走 handleError（普通 code 直传 Toast）', async (t) => {
  const { stsSvs, calls } = loadSts({
    assumeRoleErr: { code: 'InvalidParameter', message: 'bad input' },
  });

  const err = await stsSvs.assumeRole('arn', null).catch((e) => e);

  t.is(err.code, 'InvalidParameter');
  t.deepEqual(calls.toasts, ['InvalidParameter: bad input']);
  t.is(calls.stateGos.length, 0);
});

test('handleError：InvalidAccessKeyId 跳转登录页不弹 Toast', async (t) => {
  const { stsSvs, calls } = loadSts({
    assumeRoleErr: { code: 'InvalidAccessKeyId', message: 'expired' },
  });

  await stsSvs.assumeRole('arn', null).catch(() => {});

  t.deepEqual(calls.stateGos, ['login']);
  t.is(calls.toasts.length, 0);
});

test('handleError：无 code 且 Failed to fetch 归一为无法连接', async (t) => {
  const { stsSvs, calls } = loadSts({
    assumeRoleErr: { message: 'Failed to fetch https://sts.aliyuncs.com' },
  });

  await stsSvs.assumeRole('arn', null).catch(() => {});

  t.is(calls.toasts.length, 1);
  t.regex(calls.toasts[0], /^Error: 无法连接$/);
});

test('handleError：无 code 的其他 message 归一为 Error 前缀', async (t) => {
  const { stsSvs, calls } = loadSts({
    assumeRoleErr: { message: 'some network error' },
  });

  await stsSvs.assumeRole('arn', null).catch(() => {});

  t.is(calls.toasts[0], 'Error: some network error');
});

test('handleError：未授权动作追加没有权限文案且 code 覆写为 Error（存量行为）', async (t) => {
  const { stsSvs, calls } = loadSts({
    assumeRoleErr: {
      code: 'NoPermission',
      message: 'You are not authorized to do this action on resource',
    },
  });

  await stsSvs.assumeRole('arn', null).catch(() => {});

  t.is(
    calls.toasts[0],
    'Error: 没有权限, You are not authorized to do this action on resource'
  );
});