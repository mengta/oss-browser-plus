'use strict';

// 回归（2.0.0）：签名地址必须在 Node 下生成，禁止使用 ali-oss 浏览器 UMD（会报 window is not defined）。
import test from 'ava';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const accountCtx = require('../../../node/lib/account-context.js');
const oss = require('../../../node/capabilities/services/oss/index.js');

test('signatureUrl2 生成带签名的地址，不依赖浏览器 window', async (t) => {
  const url = await accountCtx.run(
    {
      auth: {
        id: 'a',
        secret: 'b',
        region: 'oss-cn-hangzhou',
        eptpl: 'http://{region}.aliyuncs.com',
      },
    },
    () => oss.signatureUrl2('oss-cn-hangzhou', 'demo-bucket', 'dir/a.txt', 600)
  );

  t.is(typeof url, 'string');
  t.true(url.includes('OSSAccessKeyId=a'));
  t.true(url.includes('Signature='));
});