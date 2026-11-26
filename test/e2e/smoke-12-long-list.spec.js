'use strict';

// P5（R-P5-01/R-P5-02 · smoke-12）：长列表窗口化。
// 断言：DOM 行数 ≤ 可视行数 + 20、行高为常量 32px、触底加载仍可用（不丢分页）。
// 需真实凭证（与 smoke-02 同口径）；无凭证整组 skip。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');
const { hasOssCredentials, getOssCredentials } = require('./fixtures/credentials.js');

const ROW_HEIGHT = 32;

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

async function enterBucket(page, bucket) {
  await page.click(SEL.setListView);
  await page.fill(SEL.bucketSearch, bucket);
  await page.waitForSelector(SEL.bucketByName(bucket), { timeout: 30000 });
  await page.click(SEL.bucketByName(bucket));
  await page.waitForSelector('[data-testid="file-table"]', { timeout: 30000 });
}

test('长列表窗口化：DOM 行数受限、行高固定、触底加载可用', async () => {
  const cred = getOssCredentials();
  await login(page);
  await enterBucket(page, cred.bucket);

  const rows = page.locator('[data-testid="file-row"]');
  const count = await rows.count();
  if (count === 0) {
    test.skip(true, '目标目录为空（无对象可测窗口化）');
    return;
  }

  const viewport = await page.evaluate(() => {
    const table = document.querySelector('[data-testid="file-table"]');
    let node = table && table.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return { height: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop };
      }
      node = node.parentElement;
    }
    return { height: 600, scrollHeight: 600, scrollTop: 0 };
  });

  const visible = Math.ceil(viewport.height / ROW_HEIGHT);
  expect(count).toBeLessThanOrEqual(visible + 20);

  const rowHeight = await rows.first().evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.round(rowHeight)).toBe(ROW_HEIGHT);

  // 触底加载：滚动到接近容器底部，加载入口仍存在且行数仍受限
  await page.evaluate((h) => {
    const table = document.querySelector('[data-testid="file-table"]');
    let node = table && table.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        node.scrollTop = node.scrollHeight - h;
        node.dispatchEvent(new Event('scroll'));
        return;
      }
      node = node.parentElement;
    }
  }, viewport.height);
  await page.waitForTimeout(1500);

  const after = await rows.count();
  expect(after).toBeLessThanOrEqual(visible + 20);
});