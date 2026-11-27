'use strict';

// 登录页左右分栏布局：品牌区/表单区语义、登录方式 tab 可访问切换、窄窗口折叠。
// 无凭证依赖，可在本机/CI 直接运行。
const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');

let app;
let page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

test('左右分栏：品牌区在左、表单卡片在右且占满剩余宽度', async () => {
  await page.waitForSelector(SEL.loginBrand, { timeout: 30000 });
  const brand = await page.locator(SEL.loginBrand).boundingBox();
  const panel = await page.locator(SEL.loginPanel).boundingBox();

  expect(brand).toBeTruthy();
  expect(panel).toBeTruthy();
  expect(brand.x).toBeLessThan(panel.x);
  expect(brand.width).toBeGreaterThan(280);
  expect(panel.width).toBeGreaterThan(400);
  // 分栏无空隙：品牌右边界与表单左边界相接
  expect(Math.abs(brand.x + brand.width - panel.x)).toBeLessThanOrEqual(2);
});

test('品牌区展示产品名与三项特性', async () => {
  await page.waitForSelector(SEL.loginBrandName, { timeout: 30000 });
  await expect(page.locator(SEL.loginBrandName)).toContainText('OSS');
  expect(await page.locator(SEL.loginFeature).count()).toBe(3);
  expect(await page.locator(SEL.loginStatus).count()).toBe(0);
  await expect(page.locator(SEL.loginProvider)).toContainText('阿里云');
});

test('登录方式 tab 语义清晰且可切换', async () => {
  await page.waitForSelector(SEL.loginTabAk, { timeout: 30000 });
  await expect(page.locator(SEL.loginTabAk)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(SEL.loginTabToken)).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator(SEL.loginCredentialForm)).toBeVisible();

  await page.locator(SEL.loginTabToken).click();

  await expect(page.locator(SEL.loginTabToken)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(SEL.loginTabAk)).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator(SEL.loginTokenForm)).toBeVisible();
  await expect(page.locator(SEL.loginCredentialForm)).toHaveCount(0);
});

test('窄窗口下品牌区折叠为顶部条，表单仍可用', async () => {
  await page.waitForSelector(SEL.loginPanel, { timeout: 30000 });
  // 登录方式会持久化在 gtab；先确保切回 AK 表单，避免受前序用例影响
  await page.locator(SEL.loginTabAk).click();
  await expect(page.locator(SEL.loginCredentialForm)).toBeVisible();

  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    // 主窗口默认 minWidth=1020，先解除限制才能验证 <=900px 的折叠断点
    win.setMinimumSize(600, 500);
    win.setSize(760, 720);
  });
  await page.waitForFunction(() => window.innerWidth <= 900, null, { timeout: 5000 });
  await page.waitForTimeout(200);

  const brand = await page.locator(SEL.loginBrand).boundingBox();
  const panel = await page.locator(SEL.loginPanel).boundingBox();

  expect(brand.width).toBeGreaterThanOrEqual(700);
  expect(panel.width).toBeGreaterThanOrEqual(700);
  expect(panel.y).toBeGreaterThanOrEqual(brand.y);
  await expect(page.locator(SEL.loginSubmit)).toBeVisible();
});
test('登录页一屏展示，无纵向滚动与右侧滚动条', async () => {
  await page.waitForSelector(SEL.loginPanel, { timeout: 30000 });
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="vue-app-main"]');
    return {
      bodyScroll: document.scrollingElement.scrollHeight,
      innerHeight: window.innerHeight,
      mainScroll: main ? main.scrollHeight : 0,
      mainClient: main ? main.clientHeight : 0,
      mainBar: main ? main.offsetWidth - main.clientWidth : 0,
    };
  });
  expect(metrics.bodyScroll).toBeLessThanOrEqual(metrics.innerHeight + 1);
  expect(metrics.mainScroll).toBeLessThanOrEqual(metrics.mainClient + 1);
  expect(metrics.mainBar).toBeLessThanOrEqual(0);
});