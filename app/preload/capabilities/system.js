'use strict';

const fs = require('fs');
const path = require('path');
const { ipcRenderer, shell } = require('electron');

const CHANNELS = {
  staticServerPort: 'app:get-static-server-port',
  openDevTools: 'app:open-dev-tools',
  refreshPage: 'app:refresh-page',
  installRestart: 'app:install-restart',
  showOpenDialog: 'dialog:show-open-dialog',
  clipboardReadText: 'clipboard:read-text',
  clipboardWriteText: 'clipboard:write-text',
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
  await invoke(CHANNELS.installRestart, [version], DEFAULT_TIMEOUT);
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
  detectInternalEndpoint,
  pathDirname,
  pathJoin,
  pathBasename,
  pathRelative,
};