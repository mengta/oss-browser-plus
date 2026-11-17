'use strict';

// 被测源：app/main/files/files.js（filesCtrl controller，1544 行）
// 覆盖锚点：spec 5.1.2——P0 逻辑函数（选择/事件/列表/状态/下载）+ P1 模态抽查 3 例（批次二 29 例规划）
// 替身策略：invokeController 模式（address-bar 先例）+ 13 项 locals 全量替身；
//           global.os={platform:()=>'win32'} 与 stubLocalStorage({}) 构造期前置（files.js:46/57）；
//           ossSvs2 为手工 spy 替身（D-08 批次解耦：不加载真实 oss2.js，录制参数回放 Promise）
// 零真实网络（spec 4.3，假凭证）；app/ 与 test/helpers/** 零变更（spec 1.4-2）

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';
import { stubLocalStorage, restoreEnv } from '../../../helpers/env-stubs.js';

// ============ 替身基建（任务 8，复用批次一模式 D-08） ============

// $timeout 替身：pending 队列 + flushAll 循环出队 + cancel + 1000 轮上限（批次一 makeTimeout 同款）
function makeTimeout() {
  const pending = [];
  const api = function (fn, ms) {
    const h = { fn, cancelled: false };
    pending.push(h);
    return h;
  };
  api.pending = pending;
  api.cancel = function (h) {
    if (h) {
      h.cancelled = true;
    }
    const idx = pending.indexOf(h);
    if (idx !== -1) {
      pending.splice(idx, 1);
    }
  };
  api.flushAll = function () {
    let rounds = 0;
    while (pending.some((h) => !h.cancelled)) {
      if (++rounds > 1000) {
        throw new Error('timeout flush exceeded 1000 rounds (possible infinite loop)');
      }
      const run = pending.splice(0, pending.length);
      run.forEach((h) => {
        if (!h.cancelled) {
          h.fn();
        }
      });
    }
    return rounds;
  };
  return api;
}

function setupFilesCtrl(t, opts = {}) {
  // 构造期前置（design 1.2.3 约束 1：files.js:46/57 在 controller 体执行期）
  global.os = { platform: () => 'win32' };
  const storage = stubLocalStorage(opts.localStorage || {});

  const reg = stubAngular();

  const _handlers = {};
  const _emitted = [];
  const uibOpens = [];
  const calls = {
    listAllBuckets: [],
    listFiles: [],
    parseOSSPath: [],
    listAllCustomDomains: [],
    signatureUrl2: [],
    getImageBase64Url: [],
    loadObjectSymlinkMeta: [],
  };
  const toasts = [];
  const confirms = [];
  let uploadDialogCb = null;
  let downloadDialogCb = null;
  let uploadDialogTimes = 0;

  const auth = Object.assign(
    { id: 'LTAI5tFake', secret: 'sk', stoken: null, region: 'oss-cn-hangzhou' },
    opts.auth || {}
  );

  // ossSvs2 手工 spy 替身（D-08：不加载真实 oss2.js——录制参数回放 Promise）
  const ossSvs2Spy = {
    parseOSSPath(p) {
      calls.parseOSSPath.push([p]);
      const rest = String(p || '').replace(/^oss:\/\//, '');
      const idx = rest.indexOf('/');
      if (!p || idx === -1) {
        return { bucket: idx === -1 && p ? rest : '', key: '' };
      }
      return { bucket: rest.substring(0, idx), key: rest.substring(idx + 1) };
    },
    listAllBuckets(...args) {
      calls.listAllBuckets.push(args);
      return Promise.resolve(opts.buckets || []);
    },
    listFiles(region, bucket, key, marker) {
      calls.listFiles.push([region, bucket, key, marker]);
      if (opts.listFilesError) {
        return Promise.reject(opts.listFilesError);
      }
      return Promise.resolve({
        data: opts.listFilesData || [],
        marker: opts.listFilesMarker !== undefined ? opts.listFilesMarker : null,
        truncated: false,
        maxKeys: 1000,
      });
    },
    listAllCustomDomains(...args) {
      calls.listAllCustomDomains.push(args);
      return Promise.resolve([]);
    },
    signatureUrl2(...args) {
      calls.signatureUrl2.push(args);
      return Promise.resolve('signed-url');
    },
    getImageBase64Url(...args) {
      calls.getImageBase64Url.push(args);
      return Promise.resolve({ ContentType: 'image/png', Body: Buffer.from('x') });
    },
    loadObjectSymlinkMeta(...args) {
      calls.loadObjectSymlinkMeta.push(args);
      return Promise.resolve({ targetName: 't' });
    },
  };

  const scope = {
    $on(evt, fn) {
      _handlers[evt] = fn;
    },
    $broadcast(evt, ...args) {
      _emitted.push({ evt, args });
    },
    $watch() {},
    handlers: { uploadFilesHandler: null, downloadFilesHandler: null },
  };

  const states = [];
  const locals = {
    $scope: scope,
    $rootScope: {
      bucketMap: {},
      currentAuthInfo: null,
      $broadcast(evt, ...args) {
        _emitted.push({ evt, args });
      },
    },
    $uibModal: {
      open(opts2) {
        uibOpens.push(opts2);
        return { result: Promise.resolve() };
      },
    },
    $timeout: makeTimeout(),
    $translate: {
      instant(k, v) {
        return v ? k + JSON.stringify(v) : k;
      },
    },
    $sce: { trustAsHtml(h) { return h; } },
    AuthInfo: { get: () => auth },
    ossSvs2: ossSvs2Spy,
    settingsSvs: {
      showImageSnapshot: { get: () => 0 },
      historiesLength: { get: () => 100 },
      connectTimeout: { get: () => 10000 },
    },
    fileSvs: { getFileType: () => ({ type: 'file' }) },
    safeApply: () => {},
    Toast: {
      success(m) { toasts.push(['success', m]); },
      warn(m) { toasts.push(['warn', m]); },
      error(m) { toasts.push(['error', m]); },
      info(m) { toasts.push(['info', m]); },
    },
    Dialog: {
      confirm(msg, cb) {
        confirms.push(cb);
        return cb(true);
      },
      showUploadDialog(cb, isFolder) {
        uploadDialogCb = cb;
        uploadDialogTimes++;
      },
      showDownloadDialog(cb) {
        downloadDialogCb = cb;
      },
    },
  };

  const $timeout = locals.$timeout;

  // 加载被测源（加载失败直接抛出使用例失败）
  reg.load('app/main/files/files.js');
  reg.invokeController('filesCtrl', locals);

  t.teardown(() => {
    delete global.os;
    unstubAll();
    restoreEnv();
  });

  return {
    scope,
    locals,
    opts,
    calls,
    toasts,
    confirms,
    uibOpens,
    _handlers,
    _emitted,
    reg,
    $timeout,
    ossSvs2: ossSvs2Spy,
    storage,
    auth,
    uploadDialog: {
      get cb() {
        return uploadDialogCb;
      },
      get times() {
        return uploadDialogTimes;
      },
      reset() {
        uploadDialogTimes = 0;
      },
    },
    downloadDialog: { get cb() { return downloadDialogCb; } },
  };
}

// ============ 冒烟（任务 8.4） ============

test('冒烟 1：invokeController 构造成功且初始状态就位', (t) => {
  const ctx = setupFilesCtrl(t);
  t.is(ctx.scope.showTab, 1);
  t.deepEqual(ctx.scope.objects, []);
  t.is(ctx.scope.ref.isBucketList, false); // 初始（init 尚未由 $timeout 驱动）
  t.is(ctx.scope.handlers.uploadFilesHandler, null);
  t.truthy(ctx.scope.sch);
  t.truthy(ctx.scope.mock.uploadsChange);
});

test('冒烟 2：init 无 osspath 进入 bucket 列表态并惰性 listBuckets', async (t) => {
  const ctx = setupFilesCtrl(t);
  ctx.$timeout.flushAll(); // 驱动 $timeout(init, 100)
  await Promise.resolve(); // 推进微任务：listAllBuckets.then 回调（filesViewReady/addEvents，files.js:793-808）

  t.is(ctx.scope.ref.isBucketList, true); // 无 osspath → bucket 列表态
  t.is(ctx.calls.listAllBuckets.length, 1); // 惰性 listBuckets 恰好 1 次
  t.true(ctx._emitted.some((e) => e.evt === 'filesViewReady')); // 就绪广播
  t.truthy(ctx._handlers.ossAddressChange); // addEvents 注册
  t.truthy(ctx._handlers.needrefreshfilelists);
  t.is(ctx.scope.mock.uploads, ''); // 初始 mock 空
});
// ============ 任务 9：P0 逻辑函数用例（选择/事件/列表/状态/下载） ============
// 断言面限定 spec 6.2-4：$scope 公开状态（sel/objects/bucket_sel/ref/sch/currentInfo/
// nextObjectsMarker/keepMoveOptions）与 $rootScope.$broadcast 事件名，不触内部闭包。
// 触达通道：initSelect/clearObjectsList/doListFiles/_downloadMulti 未直接暴露到 $scope，
// 分别经 ossAddressChange 无 bucket 分支（files.js:613）、loadNext（files.js:741-749）、
// mock.downloadsChange（files.js:496）间接触达。

// ready 前置：驱动 $timeout(init,100) → 推进 listBuckets.then 微任务（addEvents 注册、
// buckets/bucketMap 就位，files.js:793-808）→ 清剩余队列
async function ready(ctx) {
  ctx.$timeout.flushAll();
  await Promise.resolve();
  ctx.$timeout.flushAll();
}

// —— 9.1 canSetHeader filter（files.js:3-6）——

test('filter canSetHeader：全文件选择 → true', (t) => {
  const ctx = setupFilesCtrl(t);
  const canSetHeader = ctx.reg.getFilter('canSetHeader');
  t.is(canSetHeader({ has: [{ name: 'a' }, { name: 'b' }] }), true);
});

test('filter canSetHeader：任一 isFolder → false', (t) => {
  const ctx = setupFilesCtrl(t);
  const canSetHeader = ctx.reg.getFilter('canSetHeader');
  t.is(
    canSetHeader({ has: [{ name: 'a', isFolder: true }, { name: 'b' }] }),
    false
  );
});

test('filter canSetHeader：空选择（[]/false/缺 has）→ falsy', (t) => {
  const ctx = setupFilesCtrl(t);
  const canSetHeader = ctx.reg.getFilter('canSetHeader');
  // 行为锚点（files.js:5 短路链返回短路操作数原值）：空数组 → 0、has:false → false、
  // 缺 has → undefined；均 falsy，与模板布尔语境一致。按实测锚定，非缺陷不登记候选。
  t.is(canSetHeader({ has: [] }), 0);
  t.is(canSetHeader({ has: false }), false);
  t.true(!canSetHeader(undefined));
});

// —— 9.2 选择族（files.js:1080-1137）——

test('initSelect 经 clearObjectsList 复位三态（all/has/x）', async (t) => {
  const ctx = setupFilesCtrl(t);
  await ready(ctx);
  ctx.scope.objects = [{ name: 'x' }];
  ctx.scope.nextObjectsMarker = 'm';
  ctx.scope.sel.all = true;
  ctx.scope.sel.has = ctx.scope.objects;
  ctx.scope.sel.x.i_0 = true;
  ctx._handlers.ossAddressChange({}, 'oss://'); // 无 bucket 分支 → clearObjectsList
  t.is(ctx.scope.sel.all, false);
  t.is(ctx.scope.sel.has, false);
  t.deepEqual(ctx.scope.sel.x, {});
  t.deepEqual(ctx.scope.objects, []);
  t.is(ctx.scope.nextObjectsMarker, null);
});

test('selectAll 全选与再执行全取消', (t) => {
  const ctx = setupFilesCtrl(t);
  const o = [0, 1, 2].map((i) => ({ name: 'o' + i, path: 'o' + i }));
  ctx.scope.objects = o;
  ctx.scope.sel.all = true;
  ctx.scope.selectAll();
  t.is(ctx.scope.sel.has, ctx.scope.objects);
  t.is(ctx.scope.sel.x.i_0, true);
  t.is(ctx.scope.sel.x.i_1, true);
  t.is(ctx.scope.sel.x.i_2, true);
  ctx.scope.sel.all = false;
  ctx.scope.selectAll();
  t.is(ctx.scope.sel.has, false);
  t.is(ctx.scope.sel.x.i_0, false);
  t.is(ctx.scope.sel.x.i_1, false);
  t.is(ctx.scope.sel.x.i_2, false);
});

test('selectChanged 普通点击重算（单点 i_0 → has=[obj0]、all=false）', (t) => {
  const ctx = setupFilesCtrl(t);
  const o = [0, 1, 2].map((i) => ({ name: 'o' + i, path: 'o' + i }));
  ctx.scope.objects = o;
  ctx.scope.sel.x.i_0 = true; // 模拟 checkbox 置位
  ctx.scope.selectChanged({}, 0);
  t.deepEqual(ctx.scope.sel.has, [o[0]]);
  t.is(ctx.scope.sel.all, false);
});

test('selectChanged shiftKey 区间选择（lastSeleteIndex 生效）', (t) => {
  const ctx = setupFilesCtrl(t);
  const o = [0, 1, 2, 3].map((i) => ({ name: 'o' + i, path: 'o' + i }));
  ctx.scope.objects = o;
  ctx.scope.selectChanged({}, 1); // 记录 lastSeleteIndex=1
  ctx.scope.selectChanged({ shiftKey: true }, 3); // 区间 1..3 置 true
  t.is(ctx.scope.sel.x.i_1, true);
  t.is(ctx.scope.sel.x.i_2, true);
  t.is(ctx.scope.sel.x.i_3, true);
  t.deepEqual(ctx.scope.sel.has, [o[1], o[2], o[3]]);
  t.is(ctx.scope.sel.all, false);
});

test('selectChanged 全选态 all=true', (t) => {
  const ctx = setupFilesCtrl(t);
  const o = [0, 1].map((i) => ({ name: 'o' + i, path: 'o' + i }));
  ctx.scope.objects = o;
  ctx.scope.sel.x.i_0 = true;
  ctx.scope.sel.x.i_1 = true;
  ctx.scope.selectChanged({});
  t.is(ctx.scope.sel.all, true);
  t.deepEqual(ctx.scope.sel.has, o);
});

test('selectBucket 同项 toggle 反选与异项切换', (t) => {
  const ctx = setupFilesCtrl(t);
  const b1 = { name: 'b1' };
  const b2 = { name: 'b2' };
  ctx.scope.bucket_sel.item = b1;
  ctx.scope.selectBucket(b1);
  t.is(ctx.scope.bucket_sel.item, null);
  ctx.scope.selectBucket(b2);
  t.is(ctx.scope.bucket_sel.item, b2);
});

// —— 9.3 事件族（files.js:478-626）——

test('goIn 两分支拼接 goToOssAddress 广播', (t) => {
  const ctx = setupFilesCtrl(t);
  ctx.scope.goIn('bkt', 'dir/');
  let hit = ctx._emitted.find((e) => e.evt === 'goToOssAddress');
  t.is(hit.args[0], 'oss://bkt/dir/');
  ctx.scope.goIn();
  hit = ctx._emitted.filter((e) => e.evt === 'goToOssAddress').pop();
  t.is(hit.args[0], 'oss://');
});

test('handlerDrop 提取拖拽路径并阻止默认行为', (t) => {
  const ctx = setupFilesCtrl(t);
  const upCalls = [];
  ctx.scope.handlers.uploadFilesHandler = (...a) => upCalls.push(a);
  ctx.scope.currentInfo = { bucket: 'bkt', key: '' };
  let pd = 0;
  let stp = 0;
  const e = {
    originalEvent: { dataTransfer: { files: [{ path: '/a.txt' }, { path: '/b.txt' }] } },
    preventDefault() { pd++; },
    stopPropagation() { stp++; },
  };
  const r = ctx.scope.handlerDrop(e);
  t.is(r, false);
  t.is(pd, 1);
  t.is(stp, 1);
  t.is(upCalls.length, 1);
  t.deepEqual(upCalls[0][0], ['/a.txt', '/b.txt']);
  t.is(upCalls[0][1], ctx.scope.currentInfo);
});

test('uploadsChange 600ms 防抖：后调覆盖前调、flush 后恰好 1 次', (t) => {
  const ctx = setupFilesCtrl(t);
  const upCalls = [];
  ctx.scope.handlers.uploadFilesHandler = (...a) => upCalls.push(a);
  ctx.scope.currentInfo = { bucket: 'bkt', key: '' };
  ctx.scope.mock.uploads = 'a,b';
  ctx.scope.mock.uploadsChange();
  ctx.scope.mock.uploads = 'c,d';
  ctx.scope.mock.uploadsChange();
  t.is(upCalls.length, 0);
  ctx.$timeout.flushAll();
  t.is(upCalls.length, 1);
  t.deepEqual(upCalls[0][0], ['c', 'd']);
  t.is(upCalls[0][1], ctx.scope.currentInfo);
});

test('downloadsChange 600ms 防抖走 _downloadMulti 通道', (t) => {
  const ctx = setupFilesCtrl(t);
  const downCalls = [];
  ctx.scope.handlers.downloadFilesHandler = (...a) => downCalls.push(a);
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx.scope.sel.has = [{ name: 'a', path: 'a' }];
  ctx.scope.mock.downloads = '/tmp/x/';
  ctx.scope.mock.downloadsChange();
  t.is(downCalls.length, 0);
  ctx.$timeout.flushAll();
  t.is(downCalls.length, 1);
  t.is(downCalls[0][1], '/tmp/x');
  t.is(downCalls[0][0][0].region, 'r1');
  t.is(downCalls[0][0][0].bucket, 'bkt');
});

test('searchObjectName 600ms 防抖按名过滤续查', (t) => {
  const ctx = setupFilesCtrl(t);
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: 'dir/' };
  ctx.scope.sch.objectName = 'img';
  ctx.scope.searchObjectName();
  t.is(ctx.calls.listFiles.length, 0);
  ctx.$timeout.flushAll();
  t.is(ctx.calls.listFiles.length, 1);
  t.deepEqual(ctx.calls.listFiles[0], ['r1', 'bkt', 'dir/img', '']);
});

test('ossAddressChange key 尾无 / 提取 fileName 归一（含 undefined 路径不抛错）', async (t) => {
  const ctx = setupFilesCtrl(t);
  await ready(ctx);
  ctx.locals.$rootScope.bucketMap.bkt = { region: 'r1' };
  ctx._handlers.ossAddressChange({}, 'oss://bkt/dir/file.txt');
  t.is(ctx.scope.currentInfo.key, 'dir/');
  t.is(ctx.scope.sch.objectName, 'file.txt');
  t.is(ctx.scope.currentInfo.region, 'r1');
  t.is(ctx.scope.ref.isBucketList, false);
  ctx.$timeout.flushAll(); // searchObjectName 600ms 防抖
  t.is(ctx.calls.listFiles.length, 1);
  t.is(ctx.calls.listFiles[0][2], 'dir/file.txt');
  ctx._handlers.ossAddressChange({}, 'oss://bkt/dir/'); // 尾有 / → fileName undefined
  ctx.$timeout.flushAll();
  t.is(ctx.calls.listFiles.length, 2);
  t.is(ctx.calls.listFiles[1][2], 'dir/');
});

test('ossAddressChange 无权限 bucket → Toast + 列表清空', async (t) => {
  const ctx = setupFilesCtrl(t);
  await ready(ctx);
  ctx.scope.objects = [{ name: 'x' }];
  ctx._handlers.ossAddressChange({}, 'oss://nope/dir/');
  t.is(ctx.toasts.length, 1);
  t.is(ctx.toasts[0][0], 'error');
  t.is(ctx.toasts[0][1], 'No permission');
  t.deepEqual(ctx.scope.objects, []);
  t.is(ctx.scope.currentInfo.bucket, 'nope');
});

test('ossAddressChange 有 bucket → region 注入且离开 bucket 列表态', async (t) => {
  const ctx = setupFilesCtrl(t);
  await ready(ctx);
  ctx.locals.$rootScope.bucketMap.bkt = { region: 'oss-cn-hangzhou' };
  ctx._handlers.ossAddressChange({}, 'oss://bkt/dir/');
  t.is(ctx.scope.currentInfo.region, 'oss-cn-hangzhou');
  t.is(ctx.scope.ref.isBucketList, false);
  t.is(ctx.scope.currentBucket, 'bkt');
  ctx.$timeout.flushAll();
  t.is(ctx.calls.listFiles.length, 1);
});

test('ossAddressChange 无 bucket → 惰性 listBuckets（已列出不再请求、forceRefresh 请求）', async (t) => {
  const ctx = setupFilesCtrl(t);
  await ready(ctx);
  t.is(ctx.calls.listAllBuckets.length, 1); // init 惰性首次请求
  t.deepEqual(ctx.scope.buckets, []); // 已列出（空数组为 truthy）
  ctx._handlers.ossAddressChange({}, 'oss://');
  t.is(ctx.scope.ref.isBucketList, true);
  t.is(ctx.calls.listAllBuckets.length, 1); // 已列出 → 不再请求
  ctx._handlers.ossAddressChange({}, 'oss://', true);
  t.is(ctx.calls.listAllBuckets.length, 2); // forceRefresh → 请求
  t.deepEqual(ctx.scope.objects, []); // clearObjectsList 生效
});

// —— 9.4 列表族（files.js:628-755）——

test('doListFiles folders 去重补齐与 files 段拼接（loadNext 通道）', async (t) => {
  const ctx = setupFilesCtrl(t, {
    listFilesData: [
      { name: 'fb', path: 'fb/', isFolder: true },
      { name: 'fc', path: 'fc/', isFolder: true },
      { name: 'f2', path: 'f2', isFolder: false },
    ],
    listFilesMarker: 'm2',
  });
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx.scope.objects = [
    { name: 'fa', path: 'fa/', isFolder: true },
    { name: 'fb', path: 'fb/', isFolder: true },
    { name: 'f1', path: 'f1', isFolder: false },
  ];
  ctx.scope.nextObjectsMarker = 'm1';
  ctx.scope.loadNext();
  t.deepEqual(ctx.calls.listFiles[0], ['r1', 'bkt', '', 'm1']); // marker 透传
  await Promise.resolve();
  t.deepEqual(
    ctx.scope.objects.map((n) => n.name),
    ['fa', 'fb', 'fc', 'f1', 'f2'] // fb 不重复、fc 插入 folder 段、旧 f1 保留
  );
  t.is(ctx.scope.nextObjectsMarker, 'm2');
});

test('doListFiles marker 归一与错误清空回调（loadNext 通道）', async (t) => {
  const ctx = setupFilesCtrl(t, { listFilesMarker: null });
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx.scope.objects = [{ name: 'x' }];
  ctx.scope.nextObjectsMarker = 'm0';
  ctx.scope.loadNext();
  await Promise.resolve();
  t.is(ctx.scope.nextObjectsMarker, null); // marker null → null
  t.deepEqual(ctx.scope.objects, [{ name: 'x' }]); // 成功不清空（续查语义）

  const err = new Error('boom');
  const ctx2 = setupFilesCtrl(t, { listFilesError: err });
  ctx2.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx2.scope.objects = [{ name: 'x' }];
  ctx2.scope.nextObjectsMarker = 'm0';
  ctx2.scope.loadNext();
  await Promise.resolve();
  t.is(ctx2.toasts[0][0], 'error');
  t.is(ctx2.toasts[0][1], err); // fn(err) → Toast.error(err)
  t.deepEqual(ctx2.scope.objects, []); // 错误清空
  t.is(ctx2.scope.nextObjectsMarker, null);
});

test('loadNext marker 守卫（null 不续查、有 marker 续查）', (t) => {
  const ctx = setupFilesCtrl(t);
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx.scope.loadNext();
  t.is(ctx.calls.listFiles.length, 0);
  ctx.scope.nextObjectsMarker = 'm2';
  ctx.scope.loadNext();
  t.is(ctx.calls.listFiles.length, 1);
  t.is(ctx.calls.listFiles[0][3], 'm2');
});

test('getCurrentOssPath 拼接、cancelPaste 复位、clearObjectsList 清空', async (t) => {
  const ctx = setupFilesCtrl(t);
  await ready(ctx);
  ctx.scope.currentInfo = { bucket: 'bkt', key: 'a/b/' };
  t.is(ctx.scope.getCurrentOssPath(), 'oss://bkt/a/b/');
  ctx.scope.keepMoveOptions = { isCopy: true, items: [] };
  ctx.scope.cancelPaste();
  t.is(ctx.scope.keepMoveOptions, null);
  ctx.scope.objects = [{ name: 'x' }];
  ctx.scope.nextObjectsMarker = 'm';
  ctx._handlers.ossAddressChange({}, 'oss://'); // 无 bucket → clearObjectsList
  t.deepEqual(ctx.scope.objects, []);
  t.is(ctx.scope.nextObjectsMarker, null);
});

// —— 9.5 状态/下载族（files.js:58-61/1175-1190）——

test('toggleTransVisible 状态更新与 localStorage 持久化', (t) => {
  const ctx = setupFilesCtrl(t);
  ctx.scope.toggleTransVisible(true);
  t.is(ctx.scope.transVisible, true);
  t.is(ctx.storage.getItem('transVisible'), 'true');
  ctx.scope.toggleTransVisible(false);
  t.is(ctx.scope.transVisible, false);
  t.is(ctx.storage.getItem('transVisible'), 'false');
});

test('_downloadMulti 尾斜杠剥离与深拷贝不变异（downloadsChange 触发）', (t) => {
  const ctx = setupFilesCtrl(t);
  const downCalls = [];
  ctx.scope.handlers.downloadFilesHandler = (...a) => downCalls.push(a);
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: 'k' };
  const orig = { name: 'a', path: 'a' };
  ctx.scope.sel.has = [orig];
  ctx.scope.mock.downloads = '/tmp/x/';
  ctx.scope.mock.downloadsChange();
  ctx.$timeout.flushAll();
  t.is(downCalls.length, 1);
  t.is(downCalls[0][1], '/tmp/x');
  t.is(downCalls[0][0][0].region, 'r1');
  t.is(downCalls[0][0][0].bucket, 'bkt');
  t.is(downCalls[0][0][0].path, 'a');
  t.deepEqual(orig, { name: 'a', path: 'a' }); // 原对象不变异
});
// ============ 任务 10：P1 模态抽查（3 例，spec 5.1.2 授权选择性抽查） ============

test('showDeleteFiles/showDeleteFilesSelected 打开 delete-files-modal 透传 items', (t) => {
  const ctx = setupFilesCtrl(t);
  const items = [{ name: 'a', path: 'a' }];
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx.scope.showDeleteFiles(items);
  t.is(ctx.uibOpens.length, 1);
  const opt = ctx.uibOpens[0];
  t.is(opt.templateUrl, 'main/files/modals/delete-files-modal.html');
  t.is(opt.controller, 'deleteFilesModalCtrl');
  t.is(opt.resolve.items(), items);
  t.deepEqual(opt.resolve.currentInfo(), { region: 'r1', bucket: 'bkt', key: '' });
  t.truthy(opt.resolve.callback);
  ctx.scope.sel.has = items;
  ctx.scope.showDeleteFilesSelected();
  t.is(ctx.uibOpens.length, 2);
  t.is(ctx.uibOpens[1].templateUrl, 'main/files/modals/delete-files-modal.html');
  t.is(ctx.uibOpens[1].resolve.items(), ctx.scope.sel.has);
});

test('showAddFolder 与 showPaste 单项同 bucket 重命名分流', (t) => {
  const ctx = setupFilesCtrl(t);
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: 'dir/' };
  ctx.scope.showAddFolder();
  t.is(ctx.uibOpens.length, 1);
  t.is(ctx.uibOpens[0].templateUrl, 'main/files/modals/add-folder-modal.html');
  t.is(ctx.uibOpens[0].controller, 'addFolderModalCtrl');
  t.deepEqual(ctx.uibOpens[0].resolve.currentInfo(), {
    region: 'r1',
    bucket: 'bkt',
    key: 'dir/',
  });
  ctx.scope.keepMoveOptions = {
    items: [{ name: 'a', path: 'a' }],
    isCopy: true,
    currentInfo: { region: 'r1', bucket: 'bkt', key: 'src/' },
  };
  ctx.scope.showPaste();
  t.is(ctx.uibOpens.length, 2);
  t.is(ctx.uibOpens[1].templateUrl, 'main/files/modals/rename-modal.html');
  t.is(ctx.uibOpens[1].controller, 'renameModalCtrl');
  t.is(ctx.uibOpens[1].resolve.isCopy(), true); // === keepMoveOptions.isCopy
  t.deepEqual(ctx.uibOpens[1].resolve.item(), { name: 'a', path: 'a' });
});

test('showUploadDialog 600ms 防重入与空路径守卫', (t) => {
  const ctx = setupFilesCtrl(t);
  const upCalls = [];
  ctx.scope.handlers.uploadFilesHandler = (...a) => upCalls.push(a);
  ctx.scope.currentInfo = { region: 'r1', bucket: 'bkt', key: '' };
  ctx.scope.showUploadDialog();
  ctx.scope.showUploadDialog(true); // 600ms 内 → 防重入 return
  t.is(ctx.uploadDialog.times, 1);
  t.is(ctx.uibOpens.length, 0); // 上传走 Dialog.showUploadDialog，不经 $modal
  ctx.uploadDialog.cb([]);
  t.is(upCalls.length, 0); // 空路径守卫
  ctx.uploadDialog.cb(['/a.txt']);
  t.is(upCalls.length, 1);
  t.deepEqual(upCalls[0][0], ['/a.txt']);
  t.is(upCalls[0][1], ctx.scope.currentInfo);
  ctx.$timeout.flushAll(); // 复位 oudtid
  ctx.scope.showUploadDialog();
  t.is(ctx.uploadDialog.times, 2);
});