'use strict';

const fs = require('fs');
const path = require('path');
const { ipcRenderer, shell, webUtils } = require('electron');

const CHANNELS = {
  staticServerPort: 'app:get-static-server-port',
  openDevTools: 'app:open-dev-tools',
  refreshPage: 'app:refresh-page',
  installRestart: 'app:install-restart',
  rendererError: 'app:renderer-error',
  showOpenDialog: 'dialog:show-open-dialog',
  clipboardReadText: 'clipboard:read-text',
  clipboardWriteText: 'clipboard:write-text',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
};

const DEFAULT_TIMEOUT = 8000;
const DIALOG_TIMEOUT = 60000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+/;
const LANGS = ['zh-CN', 'en-US', 'ja-JP'];
const DIALOG_PROPERTIES = ['openFile', 'openDirectory', 'multiSelections'];

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function invoke(channel, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(codedError('TIMEOUT', channel + ' timed out'));
    }, timeoutMs);
    let pending;
    try {
      pending = ipcRenderer.invoke(channel, ...args);
    } catch (err) {
      clearTimeout(timer);
      settled = true;
      reject(err);
      return;
    }
    pending.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function assertHttpUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw codedError('INVALID_ARG', 'invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw codedError('INVALID_ARG', 'only http(s) urls are allowed');
  }
}

function normalizeDialogOptions(options) {
  const next = Object.assign({}, options || {});
  let properties = Array.isArray(next.properties) && next.properties.length
    ? next.properties
    : ['openFile'];
  properties = properties.filter((item) => DIALOG_PROPERTIES.indexOf(item) >= 0);
  if (properties.length === 0) properties = ['openFile'];
  next.properties = properties;
  if (next.defaultPath !== undefined && typeof next.defaultPath !== 'string') {
    throw codedError('INVALID_ARG', 'defaultPath must be a string');
  }
  return next;
}

function releaseNotePath(version, lang) {
  const dir = path.join(__dirname, 'release-notes');
  const candidates = [];
  if (lang) candidates.push(path.join(dir, version + '.' + lang + '.md'));
  candidates.push(path.join(dir, version + '.md'));
  return candidates;
}

async function getStaticServerPort() {
  const port = await invoke(CHANNELS.staticServerPort, [], DEFAULT_TIMEOUT);
  if (!Number.isFinite(port)) throw codedError('UNAVAILABLE', 'static server port is not ready');
  return port;
}

async function openDevTools() {
  await invoke(CHANNELS.openDevTools, [], DEFAULT_TIMEOUT);
  return true;
}

async function refreshPage() {
  await invoke(CHANNELS.refreshPage, [], DEFAULT_TIMEOUT);
  return true;
}

async function installAndRestart(version) {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw codedError('INVALID_ARG', 'invalid version');
  }
  // app:install-restart 是少数直接返回 IPC 信封的通道：必须检查 ok:false，
  // 否则版本/路径/安装包校验失败会被当作成功（升级静默失败）。
  const result = await invoke(CHANNELS.installRestart, [version], DEFAULT_TIMEOUT);
  if (result && result.ok === false) {
    throw codedError(result.code || 'INSTALL_FAILED', result.message || 'install failed');
  }
  return true;
}

async function showOpenDialog(options) {
  const payload = normalizeDialogOptions(options);
  const result = await invoke(CHANNELS.showOpenDialog, [payload], DIALOG_TIMEOUT);
  if (!result || typeof result !== 'object') {
    return { canceled: true, filePaths: [] };
  }
  return {
    canceled: Boolean(result.canceled),
    filePaths: Array.isArray(result.filePaths) ? result.filePaths : [],
  };
}

async function openExternal(url) {
  if (typeof url !== 'string' || !url) throw codedError('INVALID_ARG', 'url is required');
  assertHttpUrl(url);
  await shell.openExternal(url);
  return true;
}

async function showItemInFolder(targetPath) {
  if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) {
    throw codedError('INVALID_ARG', 'path must be absolute');
  }
  shell.showItemInFolder(targetPath);
  return true;
}

async function clipboardReadText() {
  return invoke(CHANNELS.clipboardReadText, [], DEFAULT_TIMEOUT);
}

async function clipboardWriteText(text) {
  if (typeof text !== 'string') throw codedError('INVALID_ARG', 'text must be a string');
  await invoke(CHANNELS.clipboardWriteText, [text], DEFAULT_TIMEOUT);
  return true;
}

async function readReleaseNotes(version, lang) {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw codedError('INVALID_ARG', 'invalid version');
  }
  const safeLang = LANGS.indexOf(lang) >= 0 ? lang : '';
  const candidates = releaseNotePath(version, safeLang);
  for (const file of candidates) {
    try {
      const markdown = fs.readFileSync(file, 'utf8');
      return { found: true, markdown };
    } catch (err) {
      if (err && err.code !== 'ENOENT') throw codedError('IO', 'failed to read release notes');
    }
  }
  return { found: false, markdown: '' };
}

async function detectInternalEndpoint(authInfo) {
  const eptpl = authInfo && authInfo.eptpl;
  if (typeof eptpl !== 'string' || !eptpl) {
    throw codedError('INVALID_ARG', 'eptpl is required');
  }
  const endpoint = eptpl.indexOf('://') >= 0 ? eptpl : 'https://' + eptpl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    await fetch(endpoint, { method: 'HEAD', signal: controller.signal, redirect: 'manual' });
    return { internalSupported: true };
  } catch (err) {
    return { internalSupported: false };
  } finally {
    clearTimeout(timer);
  }
}

function pathDirname(target) {
  if (typeof target !== 'string') throw codedError('INVALID_ARG', 'path must be a string');
  return path.dirname(target);
}

function pathJoin(parts) {
  if (!Array.isArray(parts)) throw codedError('INVALID_ARG', 'parts must be an array');
  return path.join.apply(path, parts);
}

function pathBasename(target) {
  if (typeof target !== 'string') throw codedError('INVALID_ARG', 'path must be a string');
  return path.basename(target);
}

function pathRelative(from, to) {
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw codedError('INVALID_ARG', 'paths must be strings');
  }
  return path.relative(from, to);
}

// Vue3-B3-06：拖拽取路径（Electron 32+ 移除 File.path，官方替代 webUtils.getPathForFile）
// 同步方法（channel:false）：contextBridge 传入的 File 对象经 webUtils 解析为绝对路径；不可解析返回 ''。
function getPathForFile(file) {
  if (!file) {
    throw codedError('INVALID_ARG', 'file is required');
  }
  try {
    return webUtils && typeof webUtils.getPathForFile === 'function' ? webUtils.getPathForFile(file) : '';
  } catch (err) {
    return '';
  }
}

// 无边框自绘标题栏：窗口控制（主进程承接，渲染层无 BrowserWindow 权限）
async function minimizeWindow() {
  await invoke(CHANNELS.windowMinimize, [], DEFAULT_TIMEOUT);
  return true;
}

async function toggleMaximizeWindow() {
  const maximized = await invoke(CHANNELS.windowToggleMaximize, [], DEFAULT_TIMEOUT);
  return Boolean(maximized);
}

async function closeWindow() {
  await invoke(CHANNELS.windowClose, [], DEFAULT_TIMEOUT);
  return true;
}

async function isWindowMaximized() {
  const maximized = await invoke(CHANNELS.windowIsMaximized, [], DEFAULT_TIMEOUT);
  return Boolean(maximized);
}

const WINDOW_STATE_CHANNEL = 'window:maximized-changed';
const windowStateSubscriptions = new Map();
let windowStateSeq = 0;

function subscribeWindowState(callback) {
  if (typeof callback !== 'function') throw codedError('INVALID_ARG', 'callback must be a function');
  const id = 'window-' + ++windowStateSeq;
  const handler = function (event, maximized) {
    callback(Boolean(maximized));
  };
  ipcRenderer.on(WINDOW_STATE_CHANNEL, handler);
  windowStateSubscriptions.set(id, handler);
  return id;
}

function unsubscribeWindowState(subscriptionId) {
  const handler = windowStateSubscriptions.get(subscriptionId);
  if (!handler) return true;
  ipcRenderer.removeListener(WINDOW_STATE_CHANNEL, handler);
  windowStateSubscriptions.delete(subscriptionId);
  return true;
}

// P4（R-P4-05）：渲染层错误上报（send，不等待返回；主进程限流 + 脱敏落盘）
function reportError(payload) {
  try {
    ipcRenderer.send(CHANNELS.rendererError, payload);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  getStaticServerPort,
  openDevTools,
  refreshPage,
  installAndRestart,
  showOpenDialog,
  openExternal,
  showItemInFolder,
  clipboardReadText,
  clipboardWriteText,
  readReleaseNotes,
  reportError,
  detectInternalEndpoint,
  pathDirname,
  pathJoin,
  pathBasename,
  pathRelative,
  getPathForFile,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
  subscribeWindowState,
  unsubscribeWindowState,
};