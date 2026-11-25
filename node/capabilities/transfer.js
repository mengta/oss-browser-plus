'use strict';

const path = require('path');
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

function storeFor(auth) {
  const key = auth.accessKeyId + '|' + (auth.region || '');
  if (store && storeKey === key) return store;
  const endpoint = auth.endpoint || 'https://' + (auth.region || 'oss-cn-hangzhou') + '.aliyuncs.com';
  store = new OssStore({
    aliyunCredential: { accessKeyId: auth.accessKeyId, secretAccessKey: auth.accessKeySecret },
    endpoint: endpoint,
  });
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
  job.on('statuschange', function () {
    broadcast(snapshot(taskId, entry));
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

const api = {
  createUpload,
  createDownload,
  pause,
  resume,
  cancel,
  clear,
  getTasks,
  retry,
  clearFailed,
  errorDetail,
};

module.exports = { api, setSender };