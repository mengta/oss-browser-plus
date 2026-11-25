'use strict';

// Vue3-B3 前置：升级链路主进程化（G0 留痕"传输/升级完整主进程化"）
// 渲染层 auto-upgrade.js 不再 require('./node/ossstore/lib/util')；
// 升级包下载/校验/安装与版本清单拉取全部由主进程承接。
// 状态事件经 upgrade:state 推送：{ state: idle|checking|downloading|ready|failed, percent, message }。

const path = require('path');
const fs = require('fs');
const electron = require('electron');
const ossUtil = require(path.join(__dirname, '..', 'ossstore', 'lib', 'util.js'));

const RESOURCES = path.resolve(__dirname, '..', '..');

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

let sender = null;
let current = { state: 'idle', percent: 0, message: '' };

function setSender(webContents) {
  sender = webContents;
}

function broadcast() {
  if (!sender || (typeof sender.isDestroyed === 'function' && sender.isDestroyed())) return;
  try {
    sender.send('upgrade:state', Object.assign({}, current));
  } catch (err) {}
}

function setState(patch) {
  current = Object.assign({}, current, patch);
  broadcast();
}

function compareVersion(curV, lastV) {
  const arr = String(curV).split('.');
  const arr2 = String(lastV).split('.');
  const len = Math.max(arr.length, arr2.length);
  for (let i = 0; i < len; i++) {
    const a = parseInt(arr[i], 10) || 0;
    const b = parseInt(arr2[i], 10) || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

async function check() {
  // 清单地址与 preload bootstrap DEFAULTS.upgradeUrl 同源（custom 覆盖后续经 bootstrap 透出，此处保持主进程独立读取）
  const url = 'https://oss-browser-attachment.oss-cn-hangzhou.aliyuncs.com/upgrade.json';
  const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
  const currentVersion = (pkg && pkg.version) || '0.0.0';

  setState({ state: 'checking', percent: 0, message: '' });
  let manifest;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw codedError('NETWORK', 'HTTP ' + res.status);
    manifest = await res.json();
  } catch (err) {
    setState({ state: 'idle' });
    throw codedError('NETWORK', (err && err.message) || 'manifest unreachable');
  }

  if (!manifest || !manifest.version) {
    setState({ state: 'idle' });
    throw codedError('NETWORK', 'manifest invalid');
  }

  const hasNew = compareVersion(currentVersion, manifest.version) < 0;
  const data = {
    hasNew: hasNew,
    version: manifest.version,
    currentVersion: currentVersion,
    packageUrl: manifest.package_url || '',
    packageUrls: manifest.package_urls || [],
    files: manifest.files || null,
  };
  setState({ state: 'idle' });
  return data;
}

async function download(payload) {
  if (!payload || !payload.url) throw codedError('INVALID_ARG', 'url is required');
  const version = payload.version || '';
  const fileName = payload.fileName || 'app.asar';
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    throw codedError('INVALID_ARG', 'version must match ^\\d+\\.\\d+\\.\\d+$');
  }
  const to = version
    ? path.join(RESOURCES, version + '-' + fileName)
    : path.join(RESOURCES, fileName);
  const toPart = to + '.download';

  if (fs.existsSync(to)) {
    setState({ state: 'ready', percent: 100, message: '' });
    return { path: to, finished: true };
  }

  setState({ state: 'downloading', percent: 0, message: '' });

  let res;
  try {
    res = await fetch(payload.url, { signal: AbortSignal.timeout(120000) });
  } catch (err) {
    setState({ state: 'failed', message: (err && err.message) || String(err) });
    throw codedError('NETWORK', (err && err.message) || 'download failed');
  }
  if (!res.ok) {
    setState({ state: 'failed', message: 'HTTP ' + res.status });
    throw codedError('NETWORK', 'HTTP ' + res.status);
  }

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const hashCrc64ecma = res.headers.get('x-oss-hash-crc64ecma');
  const contentMd5 = res.headers.get('content-md5');

  try {
    if (fs.existsSync(toPart)) fs.unlinkSync(toPart);
    const ws = fs.createWriteStream(toPart, { flags: 'a+' });
    const reader = res.body.getReader();
    let currentBytes = 0;
    let lastPercent = -1;

    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      currentBytes += chunk.value.length;
      const okWrite = ws.write(Buffer.from(chunk.value));
      if (!okWrite) {
        await new Promise((resolve) => ws.once('drain', resolve));
      }
      const percent = total ? Math.round((currentBytes * 100) / total) : 0;
      if (percent !== lastPercent) {
        lastPercent = percent;
        setState({ state: 'downloading', percent: percent, message: '' });
      }
    }

    await new Promise((resolve, reject) => {
      ws.end(() => {
        if (!hashCrc64ecma && !contentMd5) return resolve();
        ossUtil.checkFileHash(toPart, hashCrc64ecma, contentMd5, (err) => {
          if (err) return reject(codedError('CHECKSUM', 'hash mismatch'));
          resolve();
        });
      });
    });

    fs.renameSync(toPart, to);
  } catch (err) {
    setState({ state: 'failed', message: (err && err.message) || String(err) });
    throw err;
  }

  setState({ state: 'ready', percent: 100, message: '' });
  return { path: to, finished: true };
}

async function install(payload) {
  const version = payload && payload.version;
  if (!version || !/^\d+\.\d+\.\d+$/.test(String(version))) {
    throw codedError('INVALID_ARG', 'version must match ^\\d+\\.\\d+\\.\\d+$');
  }
  const from = path.join(RESOURCES, version + '-app.asar');
  const to = path.join(RESOURCES, 'app.asar');

  if (!fs.existsSync(from)) throw codedError('IO', 'upgrade package not found: ' + version + '-app.asar');

  await new Promise((resolve, reject) => {
    fs.rename(from, to, (err) => {
      if (!err) return resolve();
      // rename 跨设备失败时退回 copy+unlink
      const rs = fs.createReadStream(from);
      const ws = fs.createWriteStream(to);
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => {
        fs.unlink(from, () => resolve());
      });
      rs.pipe(ws);
    });
  });

  process.noAsar = true;
  electron.app.relaunch();
  electron.app.exit(0);
  return true;
}

const api = { check: check, download: download, install: install };

module.exports = { api: api, setSender: setSender, compareVersion: compareVersion };