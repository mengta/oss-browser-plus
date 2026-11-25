'use strict';

// scanFolder 目录递归单测（源 node/capabilities/transfer.js，Vue3-B3-06 / O-14）
// 锚点：目录条目（relative 以 / 结尾、isDir:true）+ 文件条目（size/relative 真实）；
// 单文件路径返回单条；空参数 INVALID_ARG；不存在 ENOENT；空目录返回 []。
// env-stubs(localStorage) 满足 ossstore 模块加载需求。

import test from 'ava';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../../helpers/env-stubs.js';
import { unstubAll } from '../../../helpers/module-stubs.js';

const require = createRequire(import.meta.url);

let transfer = null;

function load() {
  if (transfer) return transfer;
  stubLocalStorage({});
  // transfer.js 顶层加载 node/ossstore/lib/index.js（需要 localStorage）
  transfer = require('../../../../node/capabilities/transfer.js');
  return transfer;
}

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'osb-scan-'));
  fs.mkdirSync(path.join(root, 'sub', 'deep'), { recursive: true });
  fs.mkdirSync(path.join(root, 'empty'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a.txt'), 'x'.repeat(10));
  fs.writeFileSync(path.join(root, 'sub', 'b.bin'), 'y'.repeat(20));
  fs.writeFileSync(path.join(root, 'sub', 'deep', 'c.log'), 'z');
  return root;
}

test.before(() => {
  load();
});

test.after.always(() => {
  unstubAll();
});

test('目录递归：目录项 relative 以 / 结尾，文件项 size/relative 正确', (t) => {
  const root = makeTree();
  try {
    const out = load().api.scanFolder(root);
    const byRel = {};
    for (const item of out) {
      byRel[item.relative] = item;
    }

    t.deepEqual(Object.keys(byRel).sort(), [
      'a.txt',
      'empty/',
      'sub/',
      'sub/b.bin',
      'sub/deep/',
      'sub/deep/c.log',
    ]);

    t.true(byRel['sub/'].isDir);
    t.is(byRel['sub/'].size, 0);
    t.true(byRel['empty/'].isDir);
    t.false(byRel['a.txt'].isDir);
    t.is(byRel['a.txt'].size, 10);
    t.is(byRel['sub/b.bin'].size, 20);
    t.is(byRel['sub/deep/c.log'].size, 1);
    // relative 统一正斜杠（Windows 分隔符归一）
    t.false(byRel['sub/b.bin'].relative.includes('\\'));
    t.true(byRel['sub/b.bin'].path.includes(path.sep));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('单文件路径：返回单条非目录条目，relative 为文件名', (t) => {
  const root = makeTree();
  try {
    const file = path.join(root, 'a.txt');
    const out = load().api.scanFolder(file);
    t.is(out.length, 1);
    t.is(out[0].name, 'a.txt');
    t.is(out[0].relative, 'a.txt');
    t.is(out[0].isDir, false);
    t.is(out[0].size, 10);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('空目录返回空数组', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'osb-scan-empty-'));
  try {
    const out = load().api.scanFolder(root);
    t.deepEqual(out, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('参数校验：空值 INVALID_ARG；不存在 ENOENT', (t) => {
  t.throws(() => load().api.scanFolder(''), { message: /localPath is required/ });
  const missing = path.join(os.tmpdir(), 'osb-scan-not-exist-' + Date.now());
  const err = t.throws(() => load().api.scanFolder(missing));
  t.is(err.code, 'ENOENT');
});