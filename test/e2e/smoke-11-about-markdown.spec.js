'use strict';

// P2（R-P2-01/R-P2-02 · smoke-11）：关于页发行说明必须以 HTML 渲染（非纯文本）。
// 迁移后 lib.js 下线导致 window.showdown 失踪，发行说明曾静默退化为纯文本 —— 此用例防回归。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');

test('关于页发行说明渲染为 HTML 标签（非纯文本）', async () => {
  const { app, page } = await launchApp();
  try {
    await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });
    await page.click('[data-testid="topbar-brand"]');
    await page.waitForSelector(SEL.aboutModal, { timeout: 15000 });

    const body = page.locator('[data-testid="about-release-body"]');
    await expect(body).toBeVisible({ timeout: 15000 });

    const html = await body.innerHTML();
    expect(/<(h1|h2|h3|ul|ol|p|table)[\s>]/i.test(html)).toBe(true);
    expect(html).not.toContain('&lt;h1');
  } finally {
    if (app) {
      await app.close();
    }
  }
});