'use strict';

// A-06（P6c · R-P6-01/R-P6-02）：账号上下文隔离——A/B 交替、并发、key 不含 secret。
import test from 'ava';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const accountCtx = require('../../../node/lib/account-context.js');
const ossContext = require('../../../node/capabilities/services/oss/context.js');

function ctx(id, secret, region) {
  return { auth: { id, secret, region, eptpl: 'http://{region}.aliyuncs.com' } };
}

test('A-06：A/B 交替 20 次上下文不串', async (t) => {
  for (let i = 0; i < 20; i += 1) {
    const a = await accountCtx.run(ctx('A' + i, 'secretA', 'oss-cn-a'), async () => {
      await new Promise((r) => setTimeout(r, 1));
      return accountCtx.currentAuth().id;
    });
    const b = await accountCtx.run(ctx('B' + i, 'secretB', 'oss-cn-b'), async () => {
      await new Promise((r) => setTimeout(r, 1));
      return accountCtx.currentAuth().id;
    });
    t.is(a, 'A' + i);
    t.is(b, 'B' + i);
  }
});

test('A-06：10 组并发隔离', async (t) => {
  const results = await Promise.all(
    Array.from({ length: 10 }, function (_, i) {
      return accountCtx.run(ctx('C' + i, 'secretC', 'oss-cn-c'), async function () {
        await new Promise(function (r) {
          setTimeout(r, 5);
        });
        return accountCtx.currentAuth().id;
      });
    })
  );
  t.deepEqual(
    results,
    Array.from({ length: 10 }, function (_, i) {
      return 'C' + i;
    })
  );
});

test('A-06：隔离 key 不含 accessKeySecret', (t) => {
  accountCtx.run(ctx('LTAI-test', 'TOPSECRET-VALUE', 'oss-cn-hangzhou'), function () {
    const key = accountCtx.key();
    t.false(key.includes('TOPSECRET-VALUE'));
    t.true(key.includes('LTAI-test'));
    t.true(key.includes('oss-cn-hangzhou'));
  });
});

test('A-06：bucketMap 请求级隔离', (t) => {
  const a = accountCtx.run(ctx('A', 's', 'r'), function () {
    const map = ossContext.rootScope().bucketMap;
    map.bucket1 = 'internal';
    return map;
  });
  const b = accountCtx.run(ctx('B', 's', 'r'), function () {
    return ossContext.rootScope().bucketMap;
  });
  t.deepEqual(a, { bucket1: 'internal' });
  t.deepEqual(b, {});
});