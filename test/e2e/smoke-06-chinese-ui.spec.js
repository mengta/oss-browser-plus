'use strict';

// P5-01 E04 / 冒烟第 6 项：中文界面显示（不需凭证）
// 1.21.9 起登录标题已移除：品牌区只剩 logo，中文应用名落在 title 属性上。
// 断言语义相应调整为「可见的品牌 logo + 中文 title + 登录页中文文案」。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');
const zhCN = require('../../node/i18n/zh-CN.js');

let app,
  page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

test('品牌区渲染 logo，title 为中文应用名', async () => {
  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });

  await expect(page.locator(SEL.navbarBrand)).toHaveAttribute('title', SEL.navbarBrandText);
  await expect(page.locator(SEL.brandLogo)).toHaveCount(1);
  // 文字品牌随登录标题一并移除（内容为空，仅承载 logo）
  await expect(page.locator(SEL.navbarBrand)).toHaveText('');
});

test('登录页默认语言为中文（登录/历史入口文案）', async () => {
  await page.waitForSelector(SEL.loginSubmit, { timeout: 30000 });

  await expect(page.locator(SEL.loginSubmit)).toHaveText(zhCN['auth.login']);
  await expect(page.locator('[data-testid="login-histories"]')).toContainText(
    zhCN['auth.akHistories']
  );
  // 应用名在整个界面只作为 title/图片出现，不再写入正文
  await expect(page.locator(SEL.navbarBrand)).toHaveAttribute('title', zhCN['app.name']);
});