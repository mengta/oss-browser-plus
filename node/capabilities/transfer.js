'use strict';

const path = require('path');
const fs = require('fs');
const OssStore = require(path.join(__dirname, '..', 'ossstore', 'lib', 'index.js'));

const jobs = new Map();
let seq = 0;
let store = null;
let storeKey = '';
let sender = null;

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function setSender(webContents) {
  sender = webContents;
}

function broadcast(payload) {
  if (!sender || (typeof sender.isDestroyed === 'function' && sender.isDestroyed())) return;
  try {
    sender.send('transfer:progress', payload);
  } catch (err) {}
}

// Vue3-B3-09+：渲染层 auth 中的 requestpaystatus 同步到主进程 localStorage（ossstore 构造 client 时读取）
function applyRequestPay(auth) {
  const flag = auth && auth.requestpaystatus === 'YES' ? 'YES' : 'NO';
  if (global.localStorage && typeof global.localStorage.setItem === 'function') {
    global.localStorage.setItem('show-request-pay', flag);
  }
  return flag;
}

function storeFor(auth) {
  // Vue3-B3 前置：支持渲染层传入的 securityToken（STS）与显式 endpoint（getOssEndpoint 已含内网/自定义域名解析）
  const key = [
    auth.accessKeyId,
    auth.accessKeySecret,
    auth.securityToken || '',
    auth.endpoint || '',
    applyRequestPay(auth),
  ].join('|');
  if (store && storeKey === key) return store;
  const opts = {
    endpoint: auth.endpoint || 'https://' + (auth.region || 'oss-cn-hangzhou') + '.aliyuncs.com',
  };
  if (auth.securityToken) {
    opts.stsToken = {
      Credentials: {
        AccessKeyId: auth.accessKeyId,
        AccessKeySecret: auth.accessKeySecret,
        SecurityToken: auth.securityToken,
      },
    };
  } else {
    opts.aliyunCredential = { accessKeyId: auth.accessKeyId, secretAccessKey: auth.accessKeySecret };
  }
  store = new OssStore(opts);
  storeKey = key;
  return store;
}

function snapshot(taskId, entry) {
  const job = entry.job;
  const prog = job.prog || {};
  return {
    taskId: taskId,
    type: entry.type,
    status: entry.status || job.status || 'waiting',
    percent: prog.total ? Math.round((prog.loaded / prog.total) * 100) : 0,
    prog: { loaded: prog.loaded || 0, total: prog.total || 0 },
    speed: job.speed || 0,
    message: job.message || '',
    ecCode: job.ecCode || '',
    requestId: job.requestId || '',
    from: job.from || entry.options.from,
    to: job.to || entry.options.to,
    checkPoints: job.checkPoints || entry.options.checkPoints,
    crc64Str: job.crc64Str || entry.options.crc64Str,
    hashCrc64ecma: job.hashCrc64ecma || entry.options.hashCrc64ecma,
  };
}

function bind(taskId, entry) {
  const job = entry.job;
  job.on('progress', function () {
    broadcast(snapshot(taskId, entry));
  });
  // Vue3-B3 前置：透传 ossstore job 真实状态与 retryTimes（渲染层桥接适配依赖原语义事件）
  job.on('statuschange', function (status, retryTimes) {
    broadcast(
      Object.assign(snapshot(taskId, entry), {
        status: status || job.status || 'waiting',
        retryTimes: retryTimes || 0,
      })
    );
  });
  job.on('error', function (err) {
    entry.status = 'failed';
    broadcast(
      Object.assign(snapshot(taskId, entry), {
        status: 'failed',
        message: (err && err.message) || String(err),
        ecCode: (err && err.ecCode) || '',
        requestId: (err && err.requestId) || '',
      })
    );
  });
  job.on('complete', function () {
    entry.status = 'finished';
    broadcast(Object.assign(snapshot(taskId, entry), { status: 'finished', percent: 100 }));
  });
}

function createUpload(auth, options) {
  const job = storeFor(auth).createUploadJob(options || {});
  const taskId = 'up-' + ++seq;
  const entry = { type: 'upload', job: job, options: options || {}, auth: auth, status: 'waiting' };
  jobs.set(taskId, entry);
  bind(taskId, entry);
  return { taskId: taskId };
}

function createDownload(auth, options) {
  const job = storeFor(auth).createDownloadJob(options || {});
  const taskId = 'down-' + ++seq;
  const entry = { type: 'download', job: job, options: options || {}, auth: auth, status: 'waiting' };
  jobs.set(taskId, entry);
  bind(taskId, entry);
  return { taskId: taskId };
}

function getTask(taskId) {
  const entry = jobs.get(taskId);
  if (!entry) throw codedError('NOT_FOUND', 'task ' + taskId + ' not found');
  return entry;
}

function pause(taskId) {
  const entry = getTask(taskId);
  entry.job.stop();
  entry.status = 'paused';
  return true;
}

function resume(taskId) {
  const entry = getTask(taskId);
  entry.job.start();
  entry.status = 'started';
  return true;
}

function cancel(taskId) {
  const entry = getTask(taskId);
  entry.job.stop();
  entry.status = 'canceled';
  return true;
}

function clear(taskId) {
  getTask(taskId);
  jobs.delete(taskId);
  return true;
}

function getTasks() {
  const list = [];
  jobs.forEach(function (entry, taskId) {
    list.push(snapshot(taskId, entry));
  });
  return list;
}

function retry(taskId) {
  const entry = getTask(taskId);
  const options = entry.options;
  const auth = entry.auth;
  jobs.delete(taskId);
  return entry.type === 'upload' ? createUpload(auth, options) : createDownload(auth, options);
}

function clearFailed() {
  const removal = [];
  jobs.forEach(function (entry, taskId) {
    if (entry.status === 'failed') removal.push(taskId);
  });
  removal.forEach(function (taskId) {
    jobs.delete(taskId);
  });
  return true;
}

function errorDetail(taskId) {
  const entry = getTask(taskId);
  const job = entry.job;
  return {
    ecCode: job.ecCode || '',
    requestId: job.requestId || '',
    message: job.message || '',
  };
}

// Vue3-B3-06 / O-14：目录递归能力主进程化（P0 后渲染层无 fs，Angular 版递归分支已失效）。
// 返回扁平条目：[{ path, name, size, relative, isDir }]；relative 相对所选根（Windows "\" → "/"），
// 目录条目 relative 以 "/" 结尾（供渲染层建目录）；跳过符号链接（防循环）；深度上限防失控。
const SCAN_MAX_DEPTH = 64;

function scanFolder(localPath) {
  if (!localPath || typeof localPath !== 'string') {
    throw codedError('INVALID_ARG', 'localPath is required');
  }
  let stat;
  try {
    stat = fs.statSync(localPath);
  } catch (err) {
    throw codedError('ENOENT', 'path not found');
  }
  const root = stat.isDirectory() ? localPath : path.dirname(localPath);
  const toRel = (abs) => path.relative(root, abs).split(path.sep).join('/');
  const out = [];

  if (!stat.isDirectory()) {
    out.push({ path: localPath, name: path.basename(localPath), size: stat.size, relative: path.basename(localPath), isDir: false });
    return out;
  }

  const walk = (dir, depth) => {
    if (depth > SCAN_MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      let st;
      try {
        st = fs.lstatSync(abs);
      } catch (err) {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        out.push({ path: abs, name: ent.name, size: 0, relative: toRel(abs) + '/', isDir: true });
        walk(abs, depth + 1);
        continue;
      }
      if (!st.isFile()) continue;
      out.push({ path: abs, name: ent.name, size: st.size, relative: toRel(abs), isDir: false });
    }
  };

  walk(localPath, 0);
  return out;
}

// Vue3-B3-07：下载侧本地目录创建（P0 后渲染层无 fs，目录下载需 mkdir -p）。
// 入参为本地绝对路径数组（目录自身）；逐个 recursive 创建，单个失败不阻断其他。
function ensureDirs(paths) {
  if (!Array.isArray(paths)) {
    throw codedError('INVALID_ARG', 'paths must be an array');
  }
  const created = [];
  for (const p of paths) {
    if (!p || typeof p !== 'string') continue;
    try {
      fs.mkdirSync(p, { recursive: true });
      created.push(p);
    } catch (err) {
      // 单个目录创建失败不阻断（下载任务自身会暴露错误）
    }
  }
  return created;
}

const api = {
  createUpload,
  createDownload,
  applyRequestPay,
  pause,
  resume,
  cancel,
  clear,
  getTasks,
  retry,
  clearFailed,
  errorDetail,
  scanFolder,
  ensureDirs,
};

module.exports = { api, setSender };