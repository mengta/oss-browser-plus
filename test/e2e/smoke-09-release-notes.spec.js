'use strict';

// P5-01 E06 / 冒烟第 9 项：release-notes 展示（全自动，不需凭证）
// 断言：①应用静态服务（server.js rootDir=dist/static）可达（HTTP 200 且内容非空）；
// ②release-notes 数据源（dist/release-notes/{version}.md，about.js getReleaseNote 载体）存在且非空；
// ③窗口 navbar 语义断言；markdown 渲染逻辑由 about/showdown 相关行为覆盖，弹窗视觉为人工抽查项。

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { launchApp } = require('./helpers/launch.js');
const SEL = require('./helpers/selectors.js');

const PORTS = [7123, 7124, 7125, 7126];
const ROOT = path.resolve(__dirname, '..', '..');

let app,
page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

test('应用静态服务可达（dist/static 资源 HTTP 200 且非空）', async () => {
  await page.waitForSelector(SEL.navbarBrand, { timeout: 30000 });

  let ok = false;
  for (const port of PORTS) {
    try {
      // 端口轮询为串行依赖（后一端口尝试取决于前一失败），循环内 await 为正当用法
      // eslint-disable-next-line no-await-in-loop
      const res = await page.request.get(`http://127.0.0.1:${port}/jquery.min.js`);
      if (res.ok()) {
        // eslint-disable-next-line no-await-in-loop
        const body = await res.text();
        if (body && body.length > 0) {
          ok = true;
          break;
        }
      }
    } catch (e) {
      // 端口未监听，继续尝试下一个
    }
  }
  expect(ok).toBe(true);
});

test('release-notes 数据源存在且非空（about 弹窗 markdown 载体）', async () => {
  const notesDir = path.join(ROOT, 'dist', 'release-notes');
  expect(fs.existsSync(notesDir)).toBe(true);
  const mdFiles = fs.readdirSync(notesDir).filter((n) => n.endsWith('.md'));
  expect(mdFiles.length > 0).toBe(true);
  // 数据源非空：任一 release-notes markdown 文件有内容（about 弹窗渲染载体）
  const anyNote = fs.readFileSync(path.join(notesDir, mdFiles[0]), 'utf8');
  expect(anyNote.length > 0).toBe(true);
});

test('窗口 navbar 语义断言（release-notes 载体应用在运行）', async () => {
  const text = await page.textContent(SEL.navbarBrand);
  expect(text.trim()).toBe(SEL.navbarBrandText);
});