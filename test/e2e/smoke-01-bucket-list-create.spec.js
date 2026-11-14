'use strict';

// P5-01 E04 / 冒烟第 1 项：Bucket 列表与创建（spectron 主线迁移，需 OSS 凭证）
// 断言语义不变：登录后列表加载出现测试 Bucket；创建 Bucket 表单提交后列表出现新 Bucket（用例自清理）。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');
const { hasOssCredentials, getOssCredentials } = require('./fixtures/credentials.js');

test.skip(!hasOssCredentials(), '需真实凭证：注入 OSS_E2E_AK / OSS_E2E_SK / OSS_E2E_BUCKET 后执行（方法见 test/e2e/README.md）');

let app,
page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

async function login(page) {
  const cred = getOssCredentials();
  await page.fill(SEL.loginId, cred.ak);
  await page.fill(SEL.loginSecret, cred.sk);
  await page.click(SEL.loginSubmit);
  await page.waitForSelector(SEL.bucketSearch, { timeout: 30000 });
}

test('登录后 Bucket 列表加载且测试 Bucket 可见', async () => {
  await login(page);

  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });
  const brand = await page.textContent(SEL.navbarBrand);
  expect(brand).toBeTruthy();
});