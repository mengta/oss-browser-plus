'use strict';

// P5-01 E01：_electron.launch 封装（升级文档 5.6 / design 2.2.2-2）
// 入口指向 dist 构建产物（经根 package.json main 解析）、环境变量透传、TLS 开关默认关闭。
// 注意：显式清除 ELECTRON_RUN_AS_NODE（防宿主会话残留导致纯 Node 模式启动，P2 实测教训）。

const { _electron: electron } = require('playwright');

const ROOT = require('path').resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  // TLS 开关默认关闭（D7：默认走系统证书校验；Apsara Stack 场景经环境变量开启）
  delete env.OSS_BROWSER_ALLOW_INSECURE_TLS;
  env.NODE_ENV = env.NODE_ENV || 'test';

  const app = await electron.launch({
    args: ['.'],
    cwd: ROOT,
    env,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

module.exports = { launchApp, ROOT };