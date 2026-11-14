'use strict';

// download-job 基线单测（源 node/ossstore/lib/download-job.js）
// env-stubs + module-stubs（electron-log、node/crc64）；
// 重点：getNextPart/hasNextPart、DownloadJob 构造与 checkPoints 恢复字段。
// 存量瑕疵现状锁定：localStorage 键名 'downloadConcurrecyPartSize'（拼写缺 y，非 Concurrency），
// 属存量行为，非本次修复范围（design 1.2.4-2），升级后必须保持现状一致。

import test from 'ava';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../helpers/env-stubs.js';
import { stubModule, stubModuleByPath, unstubAll } from '../../helpers/module-stubs.js';

const require = createRequire(import.meta.url);

function setupDownloadPartSize(value) {
  const storage = stubLocalStorage({});
  if (value) {
    storage.setItem('downloadConcurrecyPartSize', String(value));
  }
  stubModule('electron-log', {
    transports: { file: { level: 'info' } },
    info() {},
    error() {},
  });
  stubModuleByPath('node/crc64/index.js', {
    crc64FileProcess(p, cb) {
      cb(null, 'CRC');
    },
    combileCrc64(a, b, l, cb) {
      cb(null, 'M');
    },
  });
  delete require.cache[require.resolve('../../../node/ossstore/lib/util.js')];
  delete require.cache[require.resolve('../../../node/ossstore/lib/download-job-util.js')];
  delete require.cache[require.resolve('../../../node/ossstore/lib/download-job.js')];
  const downloadJob = require('../../../node/ossstore/lib/download-job.js');
  return { downloadJob, storage };
}

test.afterEach(() => {
  unstubAll();
});

// 注：源文件内 getNextPart/hasNextPart 为模块私有函数（未挂 module.exports），
// 在“源文件零改动”约束下不单测私有函数，其行为经 DownloadJob 公有流程间接覆盖。

test('DownloadJob 构造：解析 from/to 并初始化状态与恢复字段', (t) => {
  const { downloadJob } = setupDownloadPartSize();
  const job = new downloadJob({ fake: 'oss' }, {
    from: 'oss://bucket-b/key/a.jpg',
    to: '/home/admin/a.jpg',
    region: 'oss-cn-hangzhou',
    hashCrc64ecma: 'CRC-123',
    status: 'running',
    prog: { loaded: 20, total: 100 },
    checkPoints: { uploadId: 'u-9' },
    enableCrc64: true,
  }, { ali: 'oss-sdk' });

  t.regex(job.id, /^dj-\d+-\d+$/);
  t.is(job.oss.fake, 'oss');
  t.is(job.aliOSS.ali, 'oss-sdk');
  t.deepEqual(job.from, { bucket: 'bucket-b', key: 'key/a.jpg' });
  t.deepEqual(job.to, { name: 'a.jpg', path: '/home/admin/a.jpg' });
  t.is(job.region, 'oss-cn-hangzhou');
  t.is(job.hashCrc64ecma, 'CRC-123');
  t.deepEqual(job.prog, { loaded: 20, total: 100 });
  t.is(job.status, 'running');
  t.false(job.stopFlag);
  t.is(job.checkPoints.uploadId, 'u-9');
  t.true(job.enableCrc64);
  t.is(job.writing, false);
});

test('DownloadJob 缺省 config：prog/status/stopFlag 默认值与 checkPoints 透传', (t) => {
  const { downloadJob } = setupDownloadPartSize();
  const job = new downloadJob({}, { from: 'oss://b/c', to: '/tmp/c' });

  t.deepEqual(job.prog, { loaded: 0, total: 0 });
  t.is(job.status, 'waiting');
  t.true(job.stopFlag);
  t.is(job.checkPoints, undefined);
});

test('存量瑕疵锁定：maxConcurrency 读取拼写错误键名 downloadConcurrecyPartSize', (t) => {
  // 存量瑕疵，非本次修复范围（design 1.2.4-2）：键名缺 y（Concurrecy），升级后必须保持读取同一键名，
  // 否则用户已保存的下载并发设置失效
  const { downloadJob } = setupDownloadPartSize(7);
  const job = new downloadJob({}, { from: 'oss://b/c', to: '/tmp/c' });

  t.is(job.maxConcurrency, 7);
});

test('maxConcurrency 未设置时默认 5', (t) => {
  const { downloadJob } = setupDownloadPartSize();
  const job = new downloadJob({}, { from: 'oss://b/c', to: '/tmp/c' });

  t.is(job.maxConcurrency, 5);
});

test('DownloadJob 缺 from 或 to 时仅生成 id 且不解析路径', (t) => {
  const { downloadJob } = setupDownloadPartSize();
  const jobNoFrom = new downloadJob({}, { to: '/tmp/x' });
  const jobNoTo = new downloadJob({}, { from: 'oss://b/c' });

  t.truthy(jobNoFrom.id);
  t.is(jobNoFrom.from, undefined);
  t.truthy(jobNoTo.id);
  t.is(jobNoTo.to, undefined);
});