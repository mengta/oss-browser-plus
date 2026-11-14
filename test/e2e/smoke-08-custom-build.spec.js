'use strict';

// P5-01 E06 / 冒烟第 8 项：自定义构建参数（半自动，不需凭证）
// electron-builder 产物 resources/custom/ 下文件存在且 custom/index.js 7 字段
// （title/appId/appName/logo_png/logo_ico/logo_ico/about_html）与源一致——node 断言；
// 产物缺失时 skip 并输出"先执行 electron-builder 打包"理由；
// 产物 title/logo 生效为人工启动核对说明（README.md，冒烟第 8 项核对）。

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BUILD_DIR = path.join(ROOT, 'build');
const PKG_VERSION = require(path.join(ROOT, 'package.json')).version;

function findCustomDir() {
  // electron-builder win64 产物布局：build/<name> win32-x64/resources/custom
  const candidates = [];
  if (fs.existsSync(BUILD_DIR)) {
    for (const name of fs.readdirSync(BUILD_DIR)) {
      const res = path.join(BUILD_DIR, name, 'resources', 'custom');
      if (fs.existsSync(res)) candidates.push(res);
      // NSIS 安装包布局探测（unpacked 目录）
      const unpacked = path.join(BUILD_DIR, name, 'resources', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) candidates.push(path.join(BUILD_DIR, name, 'resources'));
    }
  }
  return candidates.length > 0 ? candidates[0] : null;
}

test('产物 resources/custom 与源 custom 字段一致', async () => {
  const customDir = findCustomDir();

  test.skip(!customDir, '先执行 electron-builder 打包（如 make win64）后再运行本用例');

  const srcCustom = require(path.join(ROOT, 'custom', 'index.js'));
  const dstCustom = require(path.join(customDir, 'index.js'));

  // 7 字段契约核对（title/appId/appName/logo_png/logo_ico(ico)/logo_ico(icns)/about_html）
  // title/appId/appName 为字面值比对；logo_* 为 __dirname 绝对路径——产物内应解析到产物路径且文件存在、basename 一致
  expect(dstCustom.title).toBe(srcCustom.title);
  expect(dstCustom.appId).toBe(srcCustom.appId);
  expect(JSON.stringify(dstCustom.appName)).toBe(JSON.stringify(srcCustom.appName));
  for (const key of ['logo_png', 'logo_ico']) {
    expect(path.basename(dstCustom[key] || '')).toBe(path.basename(srcCustom[key] || ''));
    expect(fs.existsSync(dstCustom[key])).toBe(true);
  }
  expect(JSON.stringify(dstCustom.about_html)).toBe(JSON.stringify(srcCustom.about_html));
});