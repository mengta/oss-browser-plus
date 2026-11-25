'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = /[\\/]capabilities$/.test(__dirname) ? path.dirname(__dirname) : __dirname;

const DEFAULTS = {
  appId: 'oss-browser',
  appTitle: 'OSS Browser',
  logo: 'icons/icon.png',
  releaseNotesUrl: 'https://oss-browser-attachment.oss-cn-hangzhou.aliyuncs.com/release-notes/',
  upgradeUrl: 'https://oss-browser-attachment.oss-cn-hangzhou.aliyuncs.com/upgrade.json',
};

function loadModule(file) {
  try {
    return module.require(file);
  } catch (err) {
    return null;
  }
}

function readPackageVersion() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    return typeof pkg.version === 'string' ? pkg.version : '';
  } catch (err) {
    return '';
  }
}

function normalizeLocales(locales) {
  const out = {};
  if (!locales || typeof locales !== 'object') return out;
  for (const key of Object.keys(locales)) {
    const entry = locales[key];
    if (!entry || typeof entry !== 'object') continue;
    out[key] = {
      label: typeof entry.label === 'string' ? entry.label : key,
      content: entry.content && typeof entry.content === 'object' ? entry.content : {},
    };
  }
  return out;
}

function buildSnapshot() {
  const custom = loadModule(path.join(ROOT, '..', 'custom', 'index.js')) || {};
  const appName = custom.appName && typeof custom.appName === 'object' ? custom.appName : null;
  return {
    appId: custom.appId || DEFAULTS.appId,
    appVersion: custom.version || readPackageVersion() || '0.0.0',
    appTitle: custom.title || DEFAULTS.appTitle,
    appName: appName,
    logo: custom.logo_png || DEFAULTS.logo,
    aboutHtml: custom.about_html || '',
    configPath: path.join(os.homedir(), '.oss-browser'),
    releaseNotesUrl: DEFAULTS.releaseNotesUrl,
    upgradeUrl: DEFAULTS.upgradeUrl,
    locales: normalizeLocales(loadModule(path.join(ROOT, 'node', 'i18n'))),
    platform: process.platform,
arch: process.arch,
    entryHash: typeof location !== 'undefined' ? String(location.hash || '') : '',
    isDev: process.env.NODE_ENV === 'development',
  };
}

let snapshot = null;

function get() {
  if (!snapshot) snapshot = buildSnapshot();
  return snapshot;
}

module.exports = { get };