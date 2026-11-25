'use strict';

// TransferBridge（Vue3-B3 前置）契约单测（源 app/components/services/transfer-bridge.js）
// 锚点：① buildAuthPayload 的 STS/非 STS 分支与 endpoint 透传；
//      ② createJob 返回的适配 job 事件语义与 ossstore job 等价
//      （statuschange/partcomplete/speedChange/complete/error + waiting 初始态）；
//      ③ start/stop 在 taskId 未就绪时排队、就绪后按序执行（init 恢复流程依赖）。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';

const SOURCE = 'app/components/services/transfer-bridge.js';

function loadBridge(fakeTransfer) {
  global.window = { ossBrowser: { transfer: fakeTransfer } };
  const reg = stubAngular();
  reg.load(SOURCE);
  return reg.get('TransferBridge');
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

test('buildAuthPayload：STS 凭据转 securityToken，非 STS 不携带', (t) => {
  const TransferBridge = loadBridge(null);

  const sts = TransferBridge.buildAuthPayload(
    { id: 'STS.abc', secret: 'sk', stoken: 'tok-1' },
    'https://oss-cn-hangzhou.aliyuncs.com'
  );
  t.is(sts.accessKeyId, 'STS.abc');
  t.is(sts.accessKeySecret, 'sk');
  t.is(sts.securityToken, 'tok-1');
  t.is(sts.endpoint, 'https://oss-cn-hangzhou.aliyuncs.com');

  const plain = TransferBridge.buildAuthPayload(
    { id: 'LTAI', secret: 'sk', stoken: null },
    'EP'
  );
  t.is(plain.securityToken, undefined);
  t.is(plain.accessKeyId, 'LTAI');
});

test('createJob：广播驱动状态与事件（等价 ossstore 语义）', async (t) => {
  let broadcastFn = null;
  const created = [];
  const fakeTransfer = {
    subscribe(fn) { broadcastFn = fn; return 'sub-1'; },
    unsubscribe() {},
    createUpload(authPayload, opt) {
      created.push({ authPayload, opt });
      return Promise.resolve({ ok: true, data: { taskId: 'up-1' } });
    },
    pause(id) { t.is(id, 'up-1'); return Promise.resolve({ ok: true, data: true }); },
    resume(id) { return Promise.resolve({ ok: true, data: true }); },
  };
  const TransferBridge = loadBridge(fakeTransfer);

  const job = TransferBridge.createJob(
    { id: 'LTAI', secret: 'sk' },
    { region: 'cn-hangzhou', from: { name: 'a.txt', path: '/a.txt', size: 100 }, to: { bucket: 'b', key: 'a.txt' } },
    'upload',
    'EP'
  );

  t.is(job.status, 'waiting', '初始态 waiting');
  t.is(job.prog.total, 100, '上传初始 total 取 from.size');

  const events = [];
  ['statuschange', 'partcomplete', 'speedChange', 'complete', 'error'].forEach((name) => {
    job.on(name, (...args) => events.push([name, ...args]));
  });

  await delay(10);
  t.is(created.length, 1, 'createUpload 已发起');
  t.is(created[0].authPayload.securityToken, undefined);
  t.is(created[0].opt.from.name, 'a.txt', 'opt 原样透传主进程');

  broadcastFn({ taskId: 'up-1', status: 'running', prog: { loaded: 10, total: 100 }, speed: 5, retryTimes: 0 });
  t.is(job.status, 'running');
  t.is(job.prog.loaded, 10);
  t.is(events.filter((e) => e[0] === 'statuschange').length, 1);
  t.is(events.filter((e) => e[0] === 'speedChange').length, 1, 'speed 变化触发 speedChange');

  broadcastFn({ taskId: 'up-1', status: 'finished', prog: { loaded: 100, total: 100 } });
  t.is(job.status, 'finished');
  t.is(events.filter((e) => e[0] === 'complete').length, 1, 'finished 触发 complete');

  broadcastFn({ taskId: 'up-1', status: 'failed', message: 'boom', ecCode: 'E1', requestId: 'r1' });
  t.is(job.status, 'failed');
  t.is(job.message, 'boom');
  t.is(job.ecCode, 'E1');
  t.is(job.requestId, 'r1');
  const errEvent = events.find((e) => e[0] === 'error');
  t.is(errEvent[1].message, 'boom');
  t.is(errEvent[1].ecCode, 'E1');
});

test('createJob：stop/start 在 taskId 未就绪时排队，就绪后按序执行', async (t) => {
  let resolveCreate;
  const controls = [];
  const fakeTransfer = {
    subscribe() { return 'sub-1'; },
    unsubscribe() {},
    createUpload() { return new Promise((r) => { resolveCreate = r; }); },
    pause(id) { controls.push(['pause', id]); return Promise.resolve({ ok: true, data: true }); },
    resume(id) { controls.push(['resume', id]); return Promise.resolve({ ok: true, data: true }); },
  };
  const TransferBridge = loadBridge(fakeTransfer);

  const job = TransferBridge.createJob({ id: 'LTAI', secret: 'sk' }, { region: 'r', from: {}, to: {} }, 'upload', 'EP');

  job.stop();
  job.start();
  await delay(10);
  t.is(controls.length, 0, 'taskId 未就绪前不发起控制调用');

  resolveCreate({ ok: true, data: { taskId: 'up-9' } });
  await delay(10);
  t.deepEqual(controls, [['pause', 'up-9'], ['resume', 'up-9']], '就绪后按排队顺序执行');
});