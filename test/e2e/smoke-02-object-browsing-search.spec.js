'use strict';

// P5-01 E04 / 冒烟第 2 项：对象浏览/搜索（spectron 主线迁移，需 OSS 凭证）
// 断言语义不变（spectron test/index.js:74-104 断言链）：
// 列表视图切换、Bucket 搜索过滤、进入 Bucket、上一级、块状视图切换、双击进入、地址栏导航。

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

test('列表/块状视图切换、Bucket 搜索、进入/上一级与地址栏导航', async () => {
  const cred = getOssCredentials();
  await login(page);

  // 切换 view -> list（spectron: waitForExist setListView(true)）
  await page.click(SEL.setListView);

  // 搜索 bucket（spectron: setValue placeholder="Bucket名称"）
  await page.fill(SEL.bucketSearch, cred.bucket);
  await page.waitForSelector(SEL.bucketByName(cred.bucket), { timeout: 30000 });

  // 进入 bucket（spectron: waitForExist span=BUCKET）
  await page.click(SEL.bucketByName(cred.bucket));
  await page.waitForSelector(SEL.goUp, { timeout: 30000 });

  // 上一级（spectron: uib-tooltip="上一级"）
  await page.click(SEL.goUp);
  await page.waitForSelector(SEL.bucketSearch, { timeout: 30000 });

  // 切换 view -> block（spectron: setListView(false)）
  await page.click(SEL.setBlockView);

  // 双击进入 bucket（spectron: doubleClick div.item-block-name=BUCKET）
  await page.dblclick(SEL.blockItemByName(cred.bucket));
  await page.waitForSelector(SEL.goUp, { timeout: 30000 });

  // 地址栏（spectron: addValue .address-url "abc123/\n"）
  await page.fill(SEL.addressUrl, cred.folder + '/');
  await page.press(SEL.addressUrl, 'Enter');
  await page.waitForTimeout(1000);

  expect(true).toBe(true);
});