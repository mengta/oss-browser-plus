'use strict';

// P5-01 E01：_electron.launch 封装（升级文档 5.6 / design 2.2.2-2）
// 入口指向 dist 构建产物（经根 package.json main 解析）、环境变量透传、TLS 开关默认关闭。
// 注意：显式清除 ELECTRON_RUN_AS_NODE（防宿主会话残留导致纯 Node 模式启动，P2 实测教训）。

const { _electron: electron } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
// 单实例锁按 userData 目录生效：使用独立目录，避免与用户已运行的 oss-browser 实例冲突
const USER_DATA_DIR = path.join(os.tmpdir(), 'oss-browser-e2e-' + process.pid);

// B4-09 收口：AngularJS 运行时已移除；smoke-10 存量迁移断言使用 angular.element(...).injector()
// 读取 settingsSvs。按测试辅助注入最小兼容垫片（用例本体零修改），mailSender 用凭证白名单解密。
function angularShim() {
  function b64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }
  function readSecure(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const isV2 = raw.indexOf('enc:v2:') === 0;
      const isV2d = raw.indexOf('enc:v2d:') === 0;
      if (!isV2 && !isV2d) return raw;
      const prefix = isV2 ? 'enc:v2:' : 'enc:v2d:';
      const slot = localStorage.getItem('enc-dek') || '';
      let dekB64 = null;
      if (slot.indexOf('dek:p:') === 0) {
        const rel = window.ossBrowser && window.ossBrowser.credentials && window.ossBrowser.credentials.release
          ? window.ossBrowser.credentials.release(slot.slice(6))
          : null;
        dekB64 = rel && rel.ok ? rel.data : null;
      } else if (slot.indexOf('dek:d:') === 0) {
        dekB64 = slot.slice(6);
      }
      if (!dekB64) return null;
      const dec = window.ossBrowser.credentials.aesGcmDecrypt(dekB64, raw.slice(prefix.length));
      return dec && dec.ok ? b64ToUtf8(dec.data) : null;
    } catch (err) {
      return null;
    }
  }
  window.__angularShim = true;
  window.angular = {
    element: function () {
      return {
        injector: function () {
          return {
            get: function (name) {
              if (name === 'settingsSvs') {
                return {
                  mailSmtp: {
                    get: function () {
                      const text = readSecure('mailSender');
                      try {
                        return JSON.parse(text);
                      } catch (err) {
                        return {};
                      }
                    },
                  },
                };
              }
              return null;
            },
          };
        },
      };
    },
    module: function () {
      const api = {
        factory: function () { return api; },
        filter: function () { return api; },
        controller: function () { return api; },
        config: function () { return api; },
        run: function () { return api; },
      };
      return api;
    },
  };
}

async function launchApp() {
  // M2：宿主会话可能残留 ELECTRON_RUN_AS_NODE=1（Playwright 内部会合并 process.env），
  // 必须在进程级清理，否则 Electron 以 Node 模式启动（ipcMain undefined）。
  delete process.env.ELECTRON_RUN_AS_NODE;
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  // Playwright 会把 options.env 合并进 process.env：显式置 undefined 才能覆盖宿主残留键，
  // 否则子进程仍按 Node 模式启动（ipcMain undefined）。
  env.ELECTRON_RUN_AS_NODE = undefined;
  // TLS 开关默认关闭（D7：默认走系统证书校验；Apsara Stack 场景经环境变量开启）
  delete env.OSS_BROWSER_ALLOW_INSECURE_TLS;
  env.NODE_ENV = env.NODE_ENV || 'test';

  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  const app = await electron.launch({
    args: ['.', '--user-data-dir=' + USER_DATA_DIR],
    cwd: ROOT,
    env,
  });

  const page = await app.firstWindow();
  await page.addInitScript(angularShim);
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

module.exports = { launchApp, ROOT };