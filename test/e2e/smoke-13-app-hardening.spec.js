'use strict';

// P5-01 E05 / 冒烟第 13 项：应用安全基线与启动契约（无需 OSS 凭证）
// 断言链：
//   1) preload 白名单完整暴露 11 个域，渲染层不可见 Node 能力（require/process）
//   2) BrowserWindow webPreferences 为 contextIsolation=true / nodeIntegration=false
//   3) bootstrap 快照字段完整（版本/平台/语言包），供首屏与 i18n 使用
//   4) 启动链路无未捕获渲染层异常，且 app-ready 标记落地

const { test, expect } = require('@playwright/test');
const { launchApp } = require('./helpers/launch.js');

const DOMAINS = [
  'bootstrap',
  'system',
  'credentials',
  'digest',
  'storage',
  'oss',
  'sts',
  'ram',
  'mail',
  'transfer',
  'upgrade',
];

let app;
let page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

async function waitAppReady(target = page) {
  await target.waitForFunction(() => document.body.classList.contains('app-ready'), null, {
    timeout: 30000,
  });
}

test('preload 白名单暴露 11 个域且渲染层无 Node 能力', async () => {
  await waitAppReady();

  const shape = await page.evaluate(() => ({
    domains: Object.keys(window.ossBrowser || {}).sort(),
    methods: Object.fromEntries(
      Object.entries(window.ossBrowser || {}).map(([domain, api]) => [domain, Object.keys(api).sort()])
    ),
    hasRequire: typeof window.require,
    hasProcess: typeof window.process,
    hasModule: typeof window.module,
  }));

  expect(shape.domains).toEqual([...DOMAINS].sort());
  expect(shape.hasRequire).toBe('undefined');
  expect(shape.hasProcess).toBe('undefined');
  expect(shape.hasModule).toBe('undefined');

  expect(shape.methods.bootstrap).toEqual(['get']);
  expect(shape.methods.system).toEqual(
    expect.arrayContaining([
      'getStaticServerPort',
      'openExternal',
      'showOpenDialog',
      'showItemInFolder',
      'clipboardReadText',
      'clipboardWriteText',
      'installAndRestart',
      'readReleaseNotes',
      'reportError',
      'pathJoin',
      'pathDirname',
      'pathBasename',
      'pathRelative',
      'getPathForFile',
      'minimizeWindow',
      'toggleMaximizeWindow',
      'closeWindow',
      'isWindowMaximized',
      'subscribeWindowState',
      'unsubscribeWindowState',
    ])
  );
  expect(shape.methods.oss).toEqual(expect.arrayContaining(['listAllBuckets', 'listFiles', 'deleteFiles']));
  // expose=false 的内部能力不得出现在渲染世界
  expect(shape.methods.oss).not.toContain('getClient');
  expect(shape.methods.oss).not.toContain('parseOSSPath');
  expect(shape.methods.transfer).toEqual(
    expect.arrayContaining(['createUpload', 'createDownload', 'subscribe', 'unsubscribe', 'scanFolder'])
  );
});

test('BrowserWindow 安全基线：contextIsolation 开启、nodeIntegration 关闭', async () => {
  const prefs = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const web = win.webContents.getLastWebPreferences();
    return {
      contextIsolation: web.contextIsolation,
      nodeIntegration: web.nodeIntegration,
      sandbox: web.sandbox,
      webSecurity: web.webSecurity,
      plugins: web.plugins,
      preload: web.preload,
    };
  });

  expect(prefs.contextIsolation).toBe(true);
  expect(prefs.nodeIntegration).toBe(false);
  expect(prefs.sandbox).toBe(false);
  expect(prefs.webSecurity).not.toBe(false);
  // Electron 45 已从 webPreferences 快照中移除 plugins 字段：
  // 未返回时视为「显式关闭 + 运行时已无插件通道」
  expect([undefined, false]).toContain(prefs.plugins);
  // Electron 45 的 getLastWebPreferences 不再暴露 preload 路径：
  // 仅当字段可用时校验，preload 是否生效由「白名单域完整」用例兜底
  if (prefs.preload !== undefined) {
    expect(String(prefs.preload)).toContain('preload.js');
  }
});

test('bootstrap 快照字段完整（应用标识/版本/平台/语言包）', async () => {
  await waitAppReady();

  const snap = await page.evaluate(() => window.ossBrowser.bootstrap.get());

  expect(snap.ok).toBe(true);
  expect(snap.data.appId).toBeTruthy();
  expect(snap.data.appTitle).toBeTruthy();
  expect(snap.data.appVersion).toMatch(/^\d+\.\d+\.\d+/);
  expect(['win32', 'darwin', 'linux']).toContain(snap.data.platform);
  expect(snap.data.configPath).toContain('.oss-browser');
  expect(Object.keys(snap.data.locales).length).toBeGreaterThan(0);
});

test('静态服务端口经白名单可取（flv/本地资源依赖）', async () => {
  await waitAppReady();

  const res = await page.evaluate(() => window.ossBrowser.system.getStaticServerPort());

  expect(res.ok).toBe(true);
  expect(Number.isInteger(res.data)).toBe(true);
  expect(res.data).toBeGreaterThanOrEqual(1024);
});

test('启动链路无未捕获渲染层异常', async () => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));

  await page.reload();
  await waitAppReady();

  expect(errors).toEqual([]);
  const readyMarker = await page.evaluate(() => !!document.getElementById('app-ready'));
  expect(readyMarker).toBe(true);
});