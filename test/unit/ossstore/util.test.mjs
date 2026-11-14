'use strict';

// ossstore util 基线单测（源 node/ossstore/lib/util.js）
// env-stubs(localStorage) + module-stubs(electron-log、node/crc64 替身)；
// 重点：parseOssPath/parseLocalPath 纯函数、crcFinal 合并语义、checkFileHash 分支。

import test from 'ava';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../helpers/env-stubs.js';
import { stubModule, stubModuleByPath, unstubAll } from '../../helpers/module-stubs.js';

const require = createRequire(import.meta.url);

function loadUtil(crc64Fake) {
  stubLocalStorage({});
  stubModule('electron-log', {
    transports: { file: { level: 'info' } },
    info() {},
    error() {},
  });
  const fake = crc64Fake || {
    crc64FileProcess(p, cb) {
      cb(null, 'CRC-FILE');
    },
    combileCrc64(str1, str2, len2, cb) {
      cb(null, 'M:' + str1 + '+' + str2);
    },
  };
  stubModuleByPath('node/crc64/index.js', fake);
  delete require.cache[require.resolve('../../../node/ossstore/lib/util.js')];
  return require('../../../node/ossstore/lib/util.js');
}

test.afterEach(() => {
  unstubAll();
});

test('parseOssPath：标准 oss 地址拆分 bucket 与 key', (t) => {
  const util = loadUtil();
  t.deepEqual(util.parseOssPath('oss://bucket-a/dir/file.txt'), {
    bucket: 'bucket-a',
    key: 'dir/file.txt',
  });
  t.deepEqual(util.parseOssPath('oss://bucket-a'), {
    bucket: 'bucket-a',
    key: '',
  });
});

test('parseOssPath：非 oss 前缀抛 Invalid oss path，非字符串原样返回', (t) => {
  const util = loadUtil();
  t.throws(() => util.parseOssPath('http://x'), { message: 'Invalid oss path' });
  const obj = { a: 1 };
  t.is(util.parseOssPath(obj), obj);
});

test('parseLocalPath：提取文件名并保留原路径', (t) => {
  const util = loadUtil();
  t.deepEqual(util.parseLocalPath('/home/admin/a.jpg'), {
    name: 'a.jpg',
    path: '/home/admin/a.jpg',
  });
  t.is(util.parseLocalPath(42), 42);
});

test('getRetryTimes 固定返回 5', (t) => {
  const util = loadUtil();
  t.is(util.getRetryTimes(), 5);
});

test('crcFinal 按序合并各分片 crc 值', (t) => {
  const util = loadUtil();
  const out = util.crcFinal([
    { crc: 'a', len: 1 },
    { crc: 'b', len: 2 },
    { crc: 'c', len: 3 },
  ]);

  t.is(out, 'M:M:a+b+c');
});

test('crcFinal 单分片返回自身 crc', (t) => {
  const util = loadUtil();
  t.is(util.crcFinal([{ crc: 'x', len: 9 }]), 'x');
});

test('createFileIfNotExists 与 deleteFileIfExists 作用于真实文件系统', (t) => {
  const util = loadUtil();
  const tmp = path.join(os.tmpdir(), 'ossstore-util-test-' + Date.now() + '.txt');

  t.false(fs.existsSync(tmp));
  util.createFileIfNotExists(tmp);
  t.true(fs.existsSync(tmp));
  t.is(fs.statSync(tmp).size, 0);

  util.deleteFileIfExists(tmp);
  t.false(fs.existsSync(tmp));
});

test('checkFileHash：crc 匹配通过，不匹配报 HashCrc64ecma mismatch', (t) => {
  const util = loadUtil();
  const tmp = path.join(os.tmpdir(), 'ossstore-crc-test-' + Date.now() + '.txt');
  fs.writeFileSync(tmp, 'hello');

  return new Promise((resolve) => {
    util.checkFileHash(tmp, 'CRC-FILE', null, (err) => {
      t.is(err, null);
      util.checkFileHash(tmp, 'CRC-OTHER', null, (err2) => {
        t.truthy(err2);
        t.regex(err2.message, /HashCrc64ecma mismatch/);
        fs.unlinkSync(tmp);
        resolve();
      });
    });
  });
});

test('checkFileHash：md5 匹配通过，不匹配报 ContentMD5 mismatch', (t) => {
  const util = loadUtil();
  const tmp = path.join(os.tmpdir(), 'ossstore-md5-test-' + Date.now() + '.txt');
  fs.writeFileSync(tmp, 'hello');
  const good = require('crypto').createHash('md5').update('hello').digest('base64');

  return new Promise((resolve) => {
    util.checkFileHash(tmp, null, good, (err) => {
      t.is(err, null);
      util.checkFileHash(tmp, null, 'wrong-md5==', (err2) => {
        t.truthy(err2);
        t.regex(err2.message, /ContentMD5 mismatch/);
        fs.unlinkSync(tmp);
        resolve();
      });
    });
  });
});

test('checkFileHash：无校验值直通通过', (t) => {
  const util = loadUtil();
  return new Promise((resolve) => {
    util.checkFileHash('anyfile', null, null, (err) => {
      t.is(err, null);
      resolve();
    });
  });
});