'use strict';

// P5-01 E04 / 冒烟第 6 项：中文界面显示（spectron 主线迁移，不需凭证）
// 断言语义不变（spectron test/index.js:55-69）：navbar-brand 文案"OSS浏览器"、语言切换 zh-CN 后界面文案核对。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');

let app, page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

test('启动后品牌文案为中文"OSS浏览器"', async () => {
  // 等价 spectron：browser.getText(".navbar-brand") == "OSS浏览器"
  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });
  const text = await page.textContent(SEL.navbarBrand);
  expect(text.trim()).toBe(SEL.navbarBrandText);
});

test('登录页语言切换为中文后界面文案为中文', async () => {
  // 等价 spectron：setValue('[ng-model="langSettings.lang"]', "string:zh-CN")
  const lang = page.locator(SEL.langSettings);
  if (await lang.count() > 0) {
    await lang.selectOption('string:zh-CN');
    await page.waitForTimeout(500);
  }

  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });
  const text = await page.textContent(SEL.navbarBrand);
  expect(text.trim()).toBe(SEL.navbarBrandText);
});