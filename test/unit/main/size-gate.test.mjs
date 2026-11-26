'use strict';

// A-09：体积/产物完整性门禁（P1-09/P1-10）。断言阈值边界、三核心缺失与 ratio 超限可复现且非 0。
import test from 'ava';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeZip } from './helpers/make-zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const GATE = path.join(ROOT, 'tools', 'gate-size.mjs');
const LIMIT_DIST = 48447897;

function run(args) {
  return spawnSync(process.execPath, [GATE, ...args], { cwd: ROOT, encoding: 'utf8' });
}

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-size-'));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function makeDist(t, bytes) {
  const dir = path.join(tmpDir(t), 'dist');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  if (bytes) {
    const fd = fs.openSync(path.join(dir, 'big.bin'), 'w');
    fs.writeSync(fd, Buffer.alloc(bytes, 0));
    fs.closeSync(fd);
  }
  return dir;
}

function coreZip() {
  return makeZip([
    { name: 'oss-browser-1.21.9-win/oss-browser.exe', data: 'MZ' },
    { name: 'oss-browser-1.21.9-win/resources/custom/index.js', data: '// custom' },
    { name: 'oss-browser-1.21.9-win/resources/app.asar', data: 'asar' },
  ]);
}

test('gate-size：正常产物通过（dist 小 + 三核心齐备）', (t) => {
  const dir = tmpDir(t);
  const dist = makeDist(t, 0);
  const zip = path.join(dir, 'ok.zip');
  fs.writeFileSync(zip, coreZip());
  const res = run([`--dist=${dist}`, `--zip=${zip}`]);
  t.is(res.status, 0, res.stderr);
  t.true(res.stdout.includes('PASS: size gate OK'));
});

test('gate-size：dist 超限非 0 且给出 GATE_DIST_OVERSIZE', (t) => {
  const dir = tmpDir(t);
  const dist = makeDist(t, LIMIT_DIST + 1024);
  const zip = path.join(dir, 'ok.zip');
  fs.writeFileSync(zip, coreZip());
  const res = run([`--dist=${dist}`, `--zip=${zip}`]);
  t.is(res.status, 1);
  t.true(res.stderr.includes('GATE_DIST_OVERSIZE'));
});

test('gate-size：三核心缺失非 0', (t) => {
  const dir = tmpDir(t);
  const dist = makeDist(t, 0);
  const zip = path.join(dir, 'partial.zip');
  fs.writeFileSync(
    zip,
    makeZip([{ name: 'oss-browser-1.21.9-win/oss-browser.exe', data: 'MZ' }])
  );
  const res = run([`--dist=${dist}`, `--zip=${zip}`]);
  t.is(res.status, 1);
  t.true(res.stderr.includes('GATE_CORE_MISSING'));
});

test('gate-size：zip 超过上一版 110% 非 0', (t) => {
  const dir = tmpDir(t);
  const dist = makeDist(t, 0);
  const zip = path.join(dir, 'current.zip');
  const prev = path.join(dir, 'prev.zip');
  fs.writeFileSync(zip, Buffer.concat([coreZip(), Buffer.alloc(4096, 1)]));
  fs.writeFileSync(prev, Buffer.alloc(1024, 0));
  const res = run([`--dist=${dist}`, `--zip=${zip}`, `--prev=${prev}`]);
  t.is(res.status, 1);
  t.true(res.stderr.includes('GATE_ZIP_RATIO'));
});

test('gate-size：dist 缺失为参数/环境错误（退出 2）', (t) => {
  const dir = tmpDir(t);
  const zip = path.join(dir, 'ok.zip');
  fs.writeFileSync(zip, coreZip());
  const res = run([`--dist=${path.join(dir, 'nope')}`, `--zip=${zip}`]);
  t.is(res.status, 2);
  t.true(res.stderr.includes('GATE_DIST_MISSING'));
});