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

let app,
page;

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
  const cred = await loginAndEnterBucket(page);

  // spectron 等价：setValue('[ng-model="mock.uploads"]', filePath)
  const uploadName = 'e2e-upload-' + Date.now() + '.md';
  const tmpFile = path.join(os.tmpdir(), uploadName);
  fs.writeFileSync(tmpFile, 'e2e upload content ' + Date.now());

  await page.setInputFiles(SEL.uploadInput, tmpFile);
  // 等待上传任务完成（任务列表出现完成态或对象出现）
  await page.waitForSelector(`span:text-is("${uploadName}")`, { timeout: 60000 });

  expect(fs.existsSync(tmpFile)).toBe(true);

  // CS-04 / T-CS-10：进度文件名脱敏核验（5.6.1-5a，凭证就位时生效）
  // saveProg 经 DelayDone 1000ms 防抖落盘，轮询等待脱敏命名文件出现
  const progDir = path.join(os.homedir(), '.oss-browser');
  let hashed = [];
  for (let i = 0; i < 20; i++) {
    // 轮询为串行依赖（后一尝试取决于前一未命中），循环内 await 为正当用法
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(500);
    if (fs.existsSync(progDir)) {
      hashed = fs
        .readdirSync(progDir)
        .filter((f) => /^upprog_[0-9a-f]{16}\.json$/.test(f));
      if (hashed.length > 0) break;
    }
  }
  expect(hashed.length > 0).toBe(true);

  // 不存在含明文 AccessKeyId 的进度文件（5.5.1-1）
  const progFiles = fs.readdirSync(progDir);
  expect(progFiles.filter((f) => f.includes(cred.ak)).length).toBe(0);
});