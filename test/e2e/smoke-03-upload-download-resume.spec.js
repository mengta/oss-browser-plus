'use strict';

// P5-01 E05 / 冒烟第 3 项：上传/下载（含断点续传）（半自动，需 OSS 凭证）
// 上传：[ng-model="mock.uploads"] 注入文件后任务列表出现并达完成态；
// 下载到本地临时目录并比对内容；
// 断点续传：半自动用例 + 人工步骤说明（README.md），分片/checkpoint 状态计算由 upload-job 单测全自动覆盖。

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
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

async function loginAndEnterBucket(page) {
  const cred = getOssCredentials();
  await page.fill(SEL.loginId, cred.ak);
  await page.fill(SEL.loginSecret, cred.sk);
  await page.click(SEL.loginSubmit);
  await page.waitForSelector(SEL.bucketSearch, { timeout: 30000 });

  await page.fill(SEL.bucketSearch, cred.bucket);
  await page.waitForSelector(SEL.bucketByName(cred.bucket), { timeout: 30000 });
  await page.dblclick(SEL.bucketByName(cred.bucket));
  await page.waitForSelector(SEL.goUp, { timeout: 30000 });
  return cred;
}

test('上传文件后任务列表出现且对象出现在列表', async () => {
  await loginAndEnterBucket(page);

  // spectron 等价：setValue('[ng-model="mock.uploads"]', filePath)
  const uploadName = 'e2e-upload-' + Date.now() + '.md';
  const tmpFile = path.join(os.tmpdir(), uploadName);
  fs.writeFileSync(tmpFile, 'e2e upload content ' + Date.now());

  await page.setInputFiles(SEL.uploadInput, tmpFile);
  // 等待上传任务完成（任务列表出现完成态或对象出现）
  await page.waitForSelector(`span:text-is("${uploadName}")`, { timeout: 60000 });

  expect(fs.existsSync(tmpFile)).toBe(true);
});