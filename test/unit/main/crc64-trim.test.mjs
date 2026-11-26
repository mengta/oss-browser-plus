'use strict';

// A-08：crc64 跨平台裁剪（P1-02）。断言只能保留目标平台 .node 与 pure-js 兜底，
// 生成中间产物（pdb/map/obj/lib/exp）与其他平台目录不得进入 dist。
import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc64Filter } from '../../../tools/build-filters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// 构建目标平台以 dist 内实际裁剪结果为准（CI 的 macOS runner 架构可能与 matrix arch 不同），
// 未构建时回退到当前运行平台
function detectTarget() {
  const libDir = path.join(ROOT, 'dist', 'node', 'crc64', 'electron-crc64-prebuild', 'lib');
  try {
    if (fs.existsSync(libDir)) {
      const dirs = fs.readdirSync(libDir).filter((n) => n !== 'index.js');
      if (dirs.length === 1) return dirs[0];
    }
  } catch (err) {
    /* ignore */
  }
  return `${process.platform}-${process.arch}`;
}
const TARGET = detectTarget();
const OTHER_TARGETS = ['win32-x64', 'linux-x64', 'darwin-x64'].filter((p) => p !== TARGET);

test('crc64：保留目标平台 Release/*.node 与入口文件', (t) => {
  const keep = [
    'crc64/index.js',
    'crc64/fork.js',
    'crc64/pure-js/index.js',
    'crc64/pure-js/crc.js',
    'crc64/electron-crc64-prebuild/index.js',
    'crc64/electron-crc64-prebuild/package.json',
    'crc64/electron-crc64-prebuild/Readme.md',
    'crc64/electron-crc64-prebuild/lib/index.js',
    `crc64/electron-crc64-prebuild/lib/${TARGET}/Release/crc64_ecma182.node`,
  ];
  for (const rel of keep) {
    t.true(crc64Filter(rel, TARGET), rel);
  }
});

test('crc64：排除其他平台目录与中间产物', (t) => {
  const drop = [
    'crc64/cpp-addon/index.js',
    'crc64/cpp-addon/lib/win32-x64/Release/crc64.node',
    ...OTHER_TARGETS.map(
      (p) => `crc64/electron-crc64-prebuild/lib/${p}/Release/crc64_ecma182.node`
    ),
    'crc64/electron-crc64-prebuild/lib/win32-x64/Release/crc64_ecma182.pdb',
    'crc64/electron-crc64-prebuild/lib/win32-x64/Release/crc64_ecma182.map',
    'crc64/electron-crc64-prebuild/lib/win32-x64/Release/crc64_ecma182.lib',
    'crc64/electron-crc64-prebuild/lib/win32-x64/Release/obj/crc64_ecma182/x.obj',
    'crc64/electron-crc64-prebuild/lib/win32-x64/Release/obj.target/crc64_ecma182.node',
    'crc64/electron-crc64-prebuild/lib/win32-x64/crc64_ecma182.vcxproj',
  ];
  for (const rel of drop) {
    t.false(crc64Filter(rel, TARGET), rel);
  }
});

test('crc64：非 crc64 路径一律保留', (t) => {
  t.true(crc64Filter('capabilities/services/oss2.js', TARGET));
  t.true(crc64Filter('ossstore/lib/index.js', TARGET));
});

test('crc64：构建产物仅含目标平台（dist 已构建时）', (t) => {
  const libDir = path.join(ROOT, 'dist', 'node', 'crc64', 'electron-crc64-prebuild', 'lib');
  if (!fs.existsSync(libDir)) {
    t.pass('dist 未构建，跳过产物断言');
    return;
  }
  const entries = fs.readdirSync(libDir);
  const platformDirs = entries.filter((n) => n !== 'index.js');
  t.true(platformDirs.length <= 1, `平台目录应 ≤1，实际: ${platformDirs.join(',')}`);
  for (const dir of platformDirs) {
    t.is(dir, TARGET);
    const binDir = path.join(libDir, dir, 'Release');
    const files = fs.existsSync(binDir) ? fs.readdirSync(binDir) : [];
    t.true(files.some((f) => f.endsWith('.node')), '应保留 .node');
    t.false(files.some((f) => f.endsWith('.pdb')), '不应保留 .pdb');
  }
  t.false(fs.existsSync(path.join(ROOT, 'dist', 'node', 'crc64', 'cpp-addon')), 'cpp-addon 不应入 dist');
});