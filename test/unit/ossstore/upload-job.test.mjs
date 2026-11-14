'use strict';

// upload-job 基线单测（源 node/ossstore/lib/upload-job.js + upload-job-util.js）
// env-stubs + module-stubs（electron-log、electron、node/crc64）；
// 重点：genUploadNumArr 断点续传集、prepareChunks 分片计算、getSensibleChunkSize、
// getPartProgress/checkAllPartCompleted、computeMaxConcurrency、UploadJob 构造状态字段。

import test from 'ava';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../helpers/env-stubs.js';
import { stubModule, stubModuleByPath, unstubAll } from '../../helpers/module-stubs.js';

const require = createRequire(import.meta.url);

function setup(uploadPartSizeMb) {
  const storage = stubLocalStorage({});
  if (uploadPartSizeMb) {
    storage.setItem('uploadPartSize', String(uploadPartSizeMb));
  }
  stubModule('electron-log', {
    transports: { file: { level: 'info' } },
    info() {},
    error() {},
  });
  stubModule('electron', {
    ipcRenderer: {
      send() {},
      on() {},
      invoke() {
        return Promise.resolve({});
      },
    },
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
  delete require.cache[require.resolve('../../../node/ossstore/lib/upload-job-util.js')];
  delete require.cache[require.resolve('../../../node/ossstore/lib/upload-job.js')];
  const jobUtil = require('../../../node/ossstore/lib/upload-job-util.js');
  const UploadJob = require('../../../node/ossstore/lib/upload-job.js');
  return { jobUtil, UploadJob, storage };
}

test.afterEach(() => {
  unstubAll();
});

test('genUploadNumArr：返回未完成分片序号并补齐 Parts 占位', (t) => {
  const { jobUtil } = setup();
  const result = {
    chunks: [{}, {}, {}],
    Parts: {
      1: { ETag: 'etag-1' },
      2: { loaded: 100 },
    },
  };

  const tArr = jobUtil.genUploadNumArr(result);

  t.deepEqual(tArr, [1, 2]);
  t.deepEqual(result.Parts[3], { PartNumber: 3, loaded: 0 });
  t.truthy(result.Parts[2]);
});

test('genUploadNumArr：全部完成返回空数组', (t) => {
  const { jobUtil } = setup();
  const result = {
    chunks: [{}, {}],
    Parts: {
      1: { ETag: 'e1' },
      2: { ETag: 'e2' },
    },
  };

  t.deepEqual(jobUtil.genUploadNumArr(result), []);
});

test('getSensibleChunkSize：小于分片尺寸返回自身，超过时取 max(万分之一向上取整, 配置)', (t) => {
  const { jobUtil } = setup(1);

  const MB = 1024 * 1024;
  t.is(jobUtil.getSensibleChunkSize(500 * 1024), 500 * 1024);
  t.is(jobUtil.getSensibleChunkSize(2 * MB), MB);
  t.is(jobUtil.getSensibleChunkSize(20 * MB), MB);
});

test('getSensibleChunkSize：未配置默认 10MB 基准', (t) => {
  const { jobUtil } = setup();
  const MB = 1024 * 1024;

  t.is(jobUtil.getSensibleChunkSize(20 * MB), 10 * MB);
  t.is(jobUtil.getSensibleChunkSize(5 * MB), 5 * MB);
});

test('prepareChunks：按尺寸切分并保留最后一片余量', (t) => {
  const { jobUtil } = setup(1);
  const tmp = path.join(os.tmpdir(), 'ossstore-upload-' + Date.now() + '.bin');
  const size = 2.5 * 1024 * 1024;
  fs.writeFileSync(tmp, Buffer.alloc(Math.floor(size)));

  return new Promise((resolve) => {
    jobUtil.prepareChunks(tmp, {}, (err, cp) => {

      t.is(err, null);
      t.is(cp.chunks.length, 3);
      t.is(cp.chunks[0].start, 0);
      t.is(cp.chunks[0].len, 1024 * 1024);
      t.is(cp.chunks[2].len, Math.floor(size) - 2 * 1024 * 1024);
      t.is(cp.chunkSize, 1024 * 1024);
      t.is(cp.file.size, Math.floor(size));
      t.is(cp.uploadId, null);
      fs.unlinkSync(tmp);
      resolve();
    });
  });
});

test('prepareChunks：复用既有 checkPoints 的 chunkSize 与 uploadId', (t) => {
  const { jobUtil } = setup(1);
  const tmp = path.join(os.tmpdir(), 'ossstore-upload2-' + Date.now() + '.bin');
  fs.writeFileSync(tmp, Buffer.alloc(1024 * 1024));

  return new Promise((resolve) => {
    jobUtil.prepareChunks(
      tmp,
      { chunkSize: 512 * 1024, uploadId: 'up-1', Parts: { 1: { ETag: 'e' } } },
      (err, cp) => {
        t.is(cp.chunkSize, 512 * 1024);
        t.is(cp.uploadId, 'up-1');
        t.is(cp.chunks.length, 2);
        t.deepEqual(cp.Parts, { 1: { ETag: 'e' } });
        fs.unlinkSync(tmp);
        resolve();
      }
    );
  });
});

test('getPartProgress 与 checkAllPartCompleted 统计完成分片', (t) => {
  const { jobUtil } = setup();
  const cp = {
    chunks: [{}, {}, {}, {}],
    Parts: {
      1: { ETag: 'e1' },
      2: { ETag: 'e2' },
      3: { loaded: 10 },
    },
  };

  t.deepEqual(jobUtil.getPartProgress(cp), { done: 2, total: 4 });
  t.false(jobUtil.checkAllPartCompleted(cp));

  cp.Parts[3] = { ETag: 'e3' };
  cp.Parts[4] = { ETag: 'e4' };
  t.true(jobUtil.checkAllPartCompleted(cp));
});

test('computeMaxConcurrency：提速增并发，降速回落不低 5', (t) => {
  const { jobUtil } = setup();
  const MB = 1024 * 1024;

  t.is(jobUtil.computeMaxConcurrency(10 * MB, 1 * MB, 5), 10);
  t.is(jobUtil.computeMaxConcurrency(10 * MB, 1 * MB, 10), 15);
  t.is(jobUtil.computeMaxConcurrency(1 * MB, 1 * MB, 10), 7);
  t.is(jobUtil.computeMaxConcurrency(1 * MB, 1 * MB, 5), 5);
  t.is(jobUtil.computeMaxConcurrency(1 * MB, 1 * MB), 5);
});

test('UploadJob 构造：解析 from/to 并初始化状态字段', (t) => {
  const { UploadJob } = setup();
  const job = new UploadJob({ fake: 'client' }, {
    from: '/home/a.jpg',
    to: 'oss://bucket-b/key/a.jpg',
    region: 'oss-cn-hangzhou',
    status: 'running',
    prog: { loaded: 10, total: 100 },
  });

  t.regex(job.id, /^uj-\d+-\d+$/);
  t.deepEqual(job.from, { name: 'a.jpg', path: '/home/a.jpg' });
  t.deepEqual(job.to, { bucket: 'bucket-b', key: 'key/a.jpg' });
  t.is(job.region, 'oss-cn-hangzhou');
  t.is(job.status, 'running');
  t.false(job.stopFlag);
  t.deepEqual(job.prog, { loaded: 10, total: 100 });
  t.is(job.maxConcurrency, 5);
});

test('UploadJob 缺省 config 的 prog/status 与 stopFlag 默认值', (t) => {
  const { UploadJob } = setup();
  const job = new UploadJob({}, { from: 'a', to: 'oss://b/c' });

  t.deepEqual(job.prog, { loaded: 0, total: 0 });
  t.is(job.status, 'waiting');
  t.true(job.stopFlag);
});

test('UploadJob 事件机制（Base 继承）：on/emit 触发', (t) => {
  const { UploadJob } = setup();
  const job = new UploadJob({}, { from: 'a', to: 'oss://b/c' });
  const got = [];
  job.on('evt1', (x) => got.push(x));
  job.emit('evt1', 42);

  t.deepEqual(got, [42]);
});