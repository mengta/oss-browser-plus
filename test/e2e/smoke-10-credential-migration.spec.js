'use strict';

// CS-04 / T-CS-09：凭证迁移冒烟（全自动，无凭证必跑——不携带 skip 装饰，5.6.3-1）
// 流程：预置三类存量数据（auth-keep v1 密文 / auth-his v1 密文 / mailSender v0 明文）
// → reload 触发 loginCtrl init（getRemember / listHistories 读取即惰性迁移）
// → mailSender 经 Angular 注入器调用 settingsSvs.mailSmtp.get() 等价触发（design 2.4.2-2）
// → 断言：记住账号回填 / 三键升级 v2 或 v2d（win 主路径 / linux CI 降级路径二选一，
//   无明文/无旧 hex 残留断言两路径完全一致）/ SMTP 逐字段回读一致（6.3-3）/ 应用未崩溃（4.2.2-1）。

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');
const { evpBytesToKey } = require('../helpers/crypto-legacy.js');

// v1 密文生成（与 cipher.js 同语义：aes192 + EVP_BytesToKey(MD5 无盐单轮) + createCipheriv；
// KEY 字面量仅存在于 test/（产物检索范围外，4.3.1-1））
const V1_KEY = 'x82m#*lx8vv';

function v1Seal(plain) {
  const { key, iv } = evpBytesToKey(V1_KEY, 24, 16);
  const c = crypto.createCipheriv('aes192', key, iv);
  return c.update(plain, 'utf8', 'hex') + c.final('hex');
}

const KEEP_PLAIN = JSON.stringify({
  id: 'LTAI5tmigration',
  secret: 'keep-secret-e2e',
});
const HIS_PLAIN = JSON.stringify([
  { id: 'LTAI5tmigration', secret: 'his-secret-e2e' },
]);
const SMTP_PRESET = { host: 'h', port: 465, auth: { user: 'u', pass: 'p' } };

let app,
  page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

test('存量凭证惰性迁移：v1/v0 读取即升级，无明文无旧密文残留', async () => {
  // ① 预置三类存量数据（渲染层 localStorage，同会话 reload 持久）；
  // auth-remember=YES 模拟"记住账号"开启态——否则 loginCtrl 的
  // $watch('flags.remember') 初始触发 unremember 会删除预置的 auth-keep
  await page.evaluate(
    ([keepV1, hisV1, smtpV0]) => {
      localStorage.setItem('auth-keep', keepV1);
      localStorage.setItem('auth-his', hisV1);
      localStorage.setItem('mailSender', smtpV0);
      localStorage.setItem('auth-remember', 'YES');
    },
    [v1Seal(KEEP_PLAIN), v1Seal(HIS_PLAIN), JSON.stringify(SMTP_PRESET)]
  );

  // ② 触发：reload → loginCtrl init 读取 auth-keep（getRemember）与 auth-his（listHistories）→ 惰性迁移
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });

  // ③ 断言 1：记住账号输入框已回填（getRemember 迁移读取成功）。
  // navbarBrand 为静态布局元素、先于 angular bootstrap 出现，回填发生在 init 迁移链完成后，
  // 以 expect.poll 轮询等待（poll 通过即证明 init 完成，后续断言安全）
  await expect
    .poll(async () => page.inputValue(SEL.loginId), { timeout: 15000 })
    .toBe('LTAI5tmigration');

  // ③ 断言 2：mailSender 经 Angular 注入器等价触发读取并逐字段回读一致（6.3-3）
  const smtp = await page.evaluate(() => {
    const el = document.querySelector('.navbar-brand');
    const injector = window.angular.element(el).injector();
    return injector.get('settingsSvs').mailSmtp.get();
  });
  expect(smtp).toEqual(SMTP_PRESET);

  // ③ 断言 3：三键存储已升级（v2 主路径 / v2d 降级路径二选一），
  // 无明文样本、无旧 v1 hex 密文残留
  const stored = await page.evaluate(() => ({
    keep: localStorage.getItem('auth-keep'),
    his: localStorage.getItem('auth-his'),
    smtp: localStorage.getItem('mailSender'),
  }));

  for (const v of Object.values(stored)) {
    expect(v).toBeTruthy();
    expect(
      v.startsWith('enc:v2:') || v.startsWith('enc:v2d:')
    ).toBe(true);
    expect(v.includes('LTAI5tmigration')).toBe(false);
    expect(v.includes('keep-secret-e2e')).toBe(false);
    expect(v.includes('his-secret-e2e')).toBe(false);
    expect(v.includes('"pass":"p"')).toBe(false);
    expect(/^[0-9a-f]+$/.test(v)).toBe(false);
  }

  // ③ 断言 4：应用未崩溃、登录页可用（4.2.2-1）
  const brandTitle = await page.getAttribute(SEL.navbarBrand, 'title');
  expect(brandTitle).toBe(SEL.navbarBrandText);

  // 清理：移除测试预置键，避免污染本机 userData 后续手动 E2E
  await page.evaluate(() => {
    localStorage.removeItem('auth-keep');
    localStorage.removeItem('auth-his');
    localStorage.removeItem('mailSender');
    localStorage.removeItem('auth-remember');
  });
});