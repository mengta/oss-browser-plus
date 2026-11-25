'use strict';

const { ipcRenderer } = require('electron');
const { invokeChannel } = require('./shared');

const CHANNEL_TIMEOUT = 30000;
const subscriptions = new Map();
let subSeq = 0;

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function check() {
  return invokeChannel('upgrade:check', [null, []], CHANNEL_TIMEOUT);
}

function download(payload) {
  return invokeChannel('upgrade:download', [null, [payload]], CHANNEL_TIMEOUT);
}

function install(payload) {
  return invokeChannel('upgrade:install', [null, [payload]], CHANNEL_TIMEOUT);
}

function subscribe(callback) {
  if (typeof callback !== 'function') throw codedError('INVALID_ARG', 'callback must be a function');
  const id = 'upgrade-sub-' + ++subSeq;
  const handler = function (event, payload) {
    callback(payload);
  };
  ipcRenderer.on('upgrade:state', handler);
  subscriptions.set(id, handler);
  return id;
}

function unsubscribe(subscriptionId) {
  const handler = subscriptions.get(subscriptionId);
  if (!handler) return true;
  ipcRenderer.removeListener('upgrade:state', handler);
  subscriptions.delete(subscriptionId);
  return true;
}

module.exports = { check, download, install, subscribe, unsubscribe };