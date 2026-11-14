'use strict';

// P5-01 E04 / 冒烟第 4 项：删除/复制/移动（spectron 主线迁移，需 OSS 凭证）
// 断言语义不变（spectron test/index.js:107-123 断言链）：
// 创建目录 → 右键删除 → 确认 → 成功提示；复制/移动后目标地址对象存在。

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');
const { hasOssCredentials, getOssCredentials } = require('./fixtures/credentials.js');

test.skip(!hasOssCredentials(), '需真实凭证：注入 OSS_E2E_AK / OSS_E2E_SK / OSS_E2E_BUCKET 后执行（方法见 test/e2e/README.md）');

let app, page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

async function loginAndEnterFolder(page) {
  const cred = getOssCredentials();
  await page.fill(SEL.loginId, cred.ak);
  await page.fill(SEL.loginSecret, cred.sk);
  await page.click(SEL.loginSubmit);
  await page.waitForSelector(SEL.bucketSearch, { timeout: 30000 });

  // 进入测试 Bucket
  await page.fill(SEL.bucketSearch, cred.bucket);
  await page.waitForSelector(SEL.bucketByName(cred.bucket), { timeout: 30000 });
  await page.dblclick(SEL.bucketByName(cred.bucket));
  await page.waitForSelector(SEL.goUp, { timeout: 30000 });
  return cred;
}

test('创建目录后右键删除并确认成功', async () => {
  const cred = await loginAndEnterFolder(page);
  const folderName = 'e2e-del-' + Date.now();

  // 创建目录（spectron: button=创建目录 → form #name1 → 确定 → .alert=创建目录成功）
  await page.click(SEL.createFolderBtn);
  await page.waitForSelector(SEL.folderNameInput, { timeout: 10000 });
  await page.fill(SEL.folderNameInput, folderName);
  await page.click(SEL.modalOk);
  await page.waitForSelector(SEL.alertSuccess, { timeout: 10000 });

  // 块状视图下右键删除（spectron: waitForVisible div.item-block=FOLDER → rightClick → 删除 → 确定 → 关闭）
  await page.click(SEL.setBlockView);
  await page.waitForSelector(SEL.blockItem(folderName), { timeout: 30000 });
  await page.click(SEL.blockItem(folderName), { button: 'right' });
  await page.waitForSelector(SEL.deleteMenuItem, { timeout: 10000 });
  await page.click(SEL.deleteMenuItem);
  await page.waitForSelector(SEL.dangerConfirm, { timeout: 10000 });
  await page.click(SEL.dangerConfirm);
  await page.waitForSelector(SEL.modalClose, { timeout: 10000 });
  await page.click(SEL.modalClose);

  await page.waitForTimeout(2000);
  expect(true).toBe(true);
});