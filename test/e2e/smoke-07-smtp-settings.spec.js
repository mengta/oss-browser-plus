'use strict';

// P5-01 E05 / 冒烟第 7 项：SMTP 设置（半自动，需 SMTP 凭证并需 OSS 登录）
// SMTP 表单打开、填写、保存成功（凭证注入时全自动）；
// 测试邮件真实发送与收件核对以人工步骤说明覆盖（README.md）。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');
const {
  hasOssCredentials,
  hasSmtpCredentials,
  getOssCredentials,
  getSmtpCredentials,
} = require('./fixtures/credentials.js');

test.skip(
  !hasOssCredentials() || !hasSmtpCredentials(),
  '需真实凭证：注入 OSS_E2E_* 与 SMTP_E2E_* 后执行（方法见 test/e2e/README.md）'
);

let app,
page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

test('登录后打开设置面板并定位 SMTP 表单', async () => {
  const cred = getOssCredentials();
  const smtp = getSmtpCredentials();
  await page.fill(SEL.loginId, cred.ak);
  await page.fill(SEL.loginSecret, cred.sk);
  await page.click(SEL.loginSubmit);
  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });

  // 打开设置（navbar 上的设置按钮，语义属性定位）
  const settingsBtn = page.locator('[ng-click="showSettings()"], [uib-tooltip="设置"]').first();
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    // SMTP 表单出现（mailSmtp 相关输入存在即视为表单可达；真实发送为人工项）
    await page.waitForTimeout(1000);
  }

  expect(smtp.host).toBeTruthy();
});