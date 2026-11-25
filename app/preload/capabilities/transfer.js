'use strict';

const { ipcRenderer } = require('electron');
const { invokeChannel } = require('./shared');

const CHANNEL_TIMEOUT = 30000;

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function assertAuth(auth) {
  if (!auth || typeof auth !== 'object' || !auth.accessKeyId || !auth.accessKeySecret) {
    throw codedError('INVALID_ARG', 'auth.accessKeyId and auth.accessKeySecret are required');
  }
  return auth;
}

function createUpload(auth, options) {
  assertAuth(auth);
  return invokeChannel('transfer:createUpload', [auth, [options]], CHANNEL_TIMEOUT);
}

function createDownload(auth, options) {
  assertAuth(auth);
  return invokeChannel('transfer:createDownload', [auth, [options]], CHANNEL_TIMEOUT);
}

function pause(taskId) {
  return invokeChannel('transfer:pause', [null, [taskId]], CHANNEL_TIMEOUT);
}

function resume(taskId) {
  return invokeChannel('transfer:resume', [null, [taskId]], CHANNEL_TIMEOUT);
}

function cancel(taskId) {
  return invokeChannel('transfer:cancel', [null, [taskId]], CHANNEL_TIMEOUT);
}

function clear(taskId) {
  return invokeChannel('transfer:clear', [null, [taskId]], CHANNEL_TIMEOUT);
}

function getTasks() {
  return invokeChannel('transfer:getTasks', [null, []], CHANNEL_TIMEOUT);
}

function retry(taskId) {
  return invokeChannel('transfer:retry', [null, [taskId]], CHANNEL_TIMEOUT);
}

function clearFailed() {
  return invokeChannel('transfer:clearFailed', [null, []], CHANNEL_TIMEOUT);
}

function errorDetail(taskId) {
  return invokeChannel('transfer:errorDetail', [null, [taskId]], CHANNEL_TIMEOUT);
}

// Vue3-B3-06 / O-14：目录递归（主进程遍历，返回 [{path,name,size,relative,isDir}]）
function scanFolder(localPath) {
  if (!localPath || typeof localPath !== 'string') {
    throw codedError('INVALID_ARG', 'localPath is required');
  }
  return invokeChannel('transfer:scanFolder', [null, [localPath]], CHANNEL_TIMEOUT);
}

const subscriptions = new Map();
let subSeq = 0;

function subscribe(callback) {
  if (typeof callback !== 'function') throw codedError('INVALID_ARG', 'callback must be a function');
  const id = 'sub-' + ++subSeq;
  const handler = function (event, payload) {
    callback(payload);
  };
  ipcRenderer.on('transfer:progress', handler);
  subscriptions.set(id, handler);
  return id;
}

function unsubscribe(subscriptionId) {
  const handler = subscriptions.get(subscriptionId);
  if (!handler) return true;
  ipcRenderer.removeListener('transfer:progress', handler);
  subscriptions.delete(subscriptionId);
  return true;
}

module.exports = {
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
  scanFolder,
  subscribe,
  unsubscribe,
};