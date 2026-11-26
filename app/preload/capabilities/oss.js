'use strict';

const { ipcRenderer } = require('electron');
const { buildDomainApi, invokeChannel } = require('./shared');

const base = buildDomainApi('oss', 30000);

// Vue3-B3-09：批量删除/复制需要进度回调。函数无法跨 IPC，故 preload 生成 progressId，
// 主进程以 oss:progress 事件回推，preload 过滤后调用渲染层传入的回调；同时取消 30s 超时
// （批量操作耗时不定长，原版无超时）。
let progressSeq = 0;

function withProgress(channel, auth, args, progressCallback) {
  progressSeq += 1;
  const progressId = 'ossop-' + Date.now() + '-' + progressSeq;
  const listener = function (event, payload) {
    if (!payload || payload.progressId !== progressId) return;
    if (typeof progressCallback === 'function') {
      progressCallback(payload.progress);
    }
  };
  const cleanup = function () {
    ipcRenderer.removeListener('oss:progress', listener);
  };
  ipcRenderer.on('oss:progress', listener);
  return invokeChannel(channel, [auth, args.concat([{ progressId: progressId }])], 0).then(
    function (res) {
      cleanup();
      return res;
    },
    function (err) {
      cleanup();
      throw err;
    }
  );
}

module.exports = Object.assign({}, base, {
  deleteFiles: function (auth, region, bucket, items, progressCallback) {
    return withProgress('oss:deleteFiles', auth, [region, bucket, items], progressCallback);
  },
  copyFiles: function (auth, region, items, target, progressCallback, removeAfterCopy, renameKey) {
    return withProgress(
      'oss:copyFiles',
      auth,
      [region, items, target, removeAfterCopy, renameKey],
      progressCallback
    );
  },
});