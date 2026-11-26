// P4（R-P4-02/03/06）：统一日志模块。
// 契约：init(opts) / logger(module) / child / withRequestId / flush
// 事件结构：{ ts, level, module, event, requestId?, message, data? }
// 文件：info+；5MB × ≤5 份；保留 7 天（先到者）。控制台：dev=info，prod=warn。
// 禁止 silent；目录不可写 → warn 一次并转控制台（不抛错）；未 init 时退化为控制台并 warn 一次。
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { redact, redactText } = require('./redact');

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;
const RETENTION_DAYS = 7;

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const state = {
  initialized: false,
  dir: '',
  fileLevel: LEVELS.info,
  consoleLevel: process.env.NODE_ENV === 'production' ? LEVELS.warn : LEVELS.info,
  degraded: false,
  pending: [],
  maxBytes: MAX_BYTES,
  maxFiles: MAX_FILES,
  retentionDays: RETENTION_DAYS,
};

function defaultDir() {
  try {
    return path.join(os.homedir(), '.oss-browser', 'logs');
  } catch (err) {
    return path.join(__dirname, '..', '..', 'logs');
  }
}

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) +
    ':' + pad(d.getMinutes()) +
    ':' + pad(d.getSeconds()) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
  );
}

function logFilePath() {
  return path.join(state.dir, 'main.log');
}

function rotateIfNeeded() {
  const file = logFilePath();
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch (err) {
    return;
  }
  if (size < state.maxBytes) return;
  const base = logFilePath();
  const removed = base + '.' + state.maxFiles;
  try {
    fs.rmSync(removed, { force: true });
  } catch (err) {}
  for (let i = state.maxFiles - 1; i >= 1; i -= 1) {
    const from = base + '.' + i;
    const to = base + '.' + (i + 1);
    if (fs.existsSync(from)) {
      try {
        fs.renameSync(from, to);
      } catch (err) {}
    }
  }
  try {
    fs.renameSync(base, base + '.1');
  } catch (err) {}
}

function pruneOldFiles() {
  if (!state.dir) return;
  const cutoff = Date.now() - state.retentionDays * 24 * 60 * 60 * 1000;
  let names = [];
  try {
    names = fs.readdirSync(state.dir);
  } catch (err) {
    return;
  }
  for (const name of names) {
    if (name.indexOf('main.log') !== 0) continue;
    const full = path.join(state.dir, name);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true });
    } catch (err) {}
  }
}

function init(opts) {
  const options = opts || {};
  state.dir = options.dir || defaultDir();
  state.fileLevel = LEVELS[options.fileLevel || 'info'] || LEVELS.info;
  state.consoleLevel = LEVELS[options.consoleLevel || (process.env.NODE_ENV === 'production' ? 'warn' : 'info')] || LEVELS.info;
  if (Number.isFinite(options.maxBytes) && options.maxBytes > 0) state.maxBytes = Number(options.maxBytes);
  if (Number.isFinite(options.maxFiles) && options.maxFiles > 0) state.maxFiles = Number(options.maxFiles);
  if (Number.isFinite(options.retentionDays) && options.retentionDays > 0) state.retentionDays = Number(options.retentionDays);
  try {
    fs.mkdirSync(state.dir, { recursive: true });
    rotateIfNeeded();
    pruneOldFiles();
    state.initialized = true;
    state.degraded = false;
  } catch (err) {
    state.initialized = false;
    state.degraded = true;
    // 不静默：退化到控制台并 warn 一次
    console.warn('[logger] log directory unavailable, fallback to console: ' + (err && err.message));
  }
  const queued = state.pending.slice();
  state.pending = [];
  for (const entry of queued) write(entry.level, entry.module, entry.event, entry.message, entry.data, entry.requestId);
  return state.initialized;
}

function appendFileLine(line) {
  if (!state.initialized) return false;
  try {
    rotateIfNeeded();
    fs.appendFileSync(logFilePath(), line + '\n', 'utf8');
    return true;
  } catch (err) {
    if (!state.degraded) {
      state.degraded = true;
      console.warn('[logger] write failed, fallback to console: ' + (err && err.message));
    }
    return false;
  }
}

function writeToConsole(entry, line) {
  if (entry.weight < state.consoleLevel) return;
  const fn = entry.weight >= LEVELS.error ? console.error : entry.weight >= LEVELS.warn ? console.warn : console.log;
  fn(line);
}

function write(level, moduleName, event, message, data, requestId) {
  // 兼容单参调用：log.debug('message') → event='log'
  let resolvedEvent = event;
  let resolvedMessage = message;
  if (message === undefined) {
    resolvedMessage = event;
    resolvedEvent = 'log';
  }
  const weight = LEVELS[level] || LEVELS.info;
  const entry = {
    weight,
    level,
    module: moduleName || 'app',
    event: resolvedEvent || 'log',
    message: redactText(resolvedMessage === undefined ? '' : resolvedMessage),
    data: data === undefined ? undefined : redact(data),
    requestId: requestId || undefined,
  };
  const payload = {
    ts: nowIso(),
    level: entry.level,
    module: entry.module,
    event: entry.event,
  };
  if (entry.requestId) payload.requestId = entry.requestId;
  payload.message = entry.message;
  if (entry.data !== undefined) payload.data = entry.data;
  const line = stamp() + ' ' + JSON.stringify(payload);

  if (!state.initialized) {
    if (state.pending.length < 200) state.pending.push(entry);
    writeToConsole(entry, line);
    return;
  }
  if (entry.weight >= state.fileLevel) appendFileLine(line);
  writeToConsole(entry, line);
}

function makeLogger(moduleName, requestId) {
  return {
    debug: (event, message, data) => write('debug', moduleName, event, message, data, requestId),
    info: (event, message, data) => write('info', moduleName, event, message, data, requestId),
    warn: (event, message, data) => write('warn', moduleName, event, message, data, requestId),
    error: (event, message, data) => write('error', moduleName, event, message, data, requestId),
    child: (childModule) => makeLogger(moduleName + '.' + childModule, requestId),
    withRequestId: (id) => makeLogger(moduleName, id),
  };
}

function logger(moduleName) {
  return makeLogger(moduleName || 'app', undefined);
}

function flush() {
  return state.pending.length;
}

function current() {
  return { dir: state.dir, initialized: state.initialized, degraded: state.degraded };
}

module.exports = { init, logger, flush, current, LEVELS };