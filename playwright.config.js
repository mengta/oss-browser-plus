'use strict';

// P5-01 E01：Playwright 配置（升级文档 5.6 / design 2.2.2-2）
// workers=1：应用 requestSingleInstanceLock 单实例约束 + 静态服务端口 7123-7126 不可多实例争用
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60 * 1000,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  globalSetup: './test/e2e/helpers/global-setup.js',
});