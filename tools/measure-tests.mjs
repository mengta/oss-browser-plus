// P2（R-P2-05 · 门禁 ⑬）：统计测试用例 passed/skipped，写入/校验 docs/metrics.md 受管区块。
// 数字必须由脚本产生（禁止手工填写）：
//   node tools/measure-tests.mjs --write        运行 ava + Vitest 并写入区块
//   node tools/measure-tests.mjs --check        运行并校验与区块一致（不一致非 0）
//   --with-e2e                                 额外运行 Playwright（默认跳过，环境依赖强）
// 退出码：0 一致/写入成功；1 不一致或测试失败；2 参数/环境错误。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METRICS = path.join(ROOT, 'docs', 'metrics.md');
const START = '<!-- metrics:tests:start -->';
const END = '<!-- metrics:tests:end -->';

const args = process.argv.slice(2);
const write = args.includes('--write');
const check = args.includes('--check');
const withE2e = args.includes('--with-e2e');

if ((write && check) || (!write && !check)) {
  console.error('usage: node tools/measure-tests.mjs --write|--check [--with-e2e]');
  process.exit(2);
}

function run(cmd, argv, opts = {}) {
  const res = spawnSync(cmd, argv, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 128 * 1024 * 1024,
    ...opts,
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function parseAvaTap(output) {
  const tests = /^# tests (\d+)/m.exec(output);
  const pass = /^# pass (\d+)/m.exec(output);
  const skip = /^# skip (\d+)/m.exec(output);
  const fail = /^# fail (\d+)/m.exec(output);
  return {
    passed: pass ? Number(pass[1]) : tests ? Number(tests[1]) : 0,
    skipped: skip ? Number(skip[1]) : 0,
    failed: fail ? Number(fail[1]) : 0,
    total: tests ? Number(tests[1]) : 0,
  };
}

function collectAva() {
  const res = run('npx', ['ava', '--tap']);
  const stat = parseAvaTap(res.stdout + '\n' + res.stderr);
  if (res.status !== 0 && stat.total === 0) {
    return { ...stat, error: `ava exit ${res.status}` };
  }
  return stat;
}

function collectVitest() {
  const reportPath = path.join(ROOT, 'vitest-report.json');
  const res = run('npx', ['vitest', 'run', '--reporter=json', '--outputFile', reportPath]);
  if (!fs.existsSync(reportPath)) {
    return { passed: 0, skipped: 0, failed: 0, total: 0, error: `vitest exit ${res.status}` };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  fs.rmSync(reportPath, { force: true });
  return {
    passed: Number(report.numPassedTests || 0),
    skipped: Number(report.numPendingTests || 0),
    failed: Number(report.numFailedTests || 0),
    total: Number(report.numTotalTests || 0),
  };
}

function collectE2e() {
  if (!withE2e) {
    return { passed: '未采集', skipped: '未采集', failed: '未采集', total: '未采集' };
  }
  const res = run('npx', ['playwright', 'test', '--reporter=json']);
  const line = res.stdout.trim().split('\n').pop() || '';
  try {
    const report = JSON.parse(line);
    const stats = report.stats || {};
    return {
      passed: Number(stats.expected || 0),
      skipped: Number(stats.skipped || 0),
      failed: Number(stats.unexpected || 0),
      total: Number(stats.expected || 0) + Number(stats.skipped || 0) + Number(stats.unexpected || 0),
    };
  } catch {
    return { passed: 0, skipped: 0, failed: 0, total: 0, error: `playwright exit ${res.status}` };
  }
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ava = collectAva();
const vitest = collectVitest();
const e2e = collectE2e();

const block = [
  START,
  `| 套件 | passed | skipped | failed | total | 采集时间 |`,
  `| --- | --- | --- | --- | --- | --- |`,
  `| ava | ${ava.passed} | ${ava.skipped} | ${ava.failed} | ${ava.total} | ${stamp()} |`,
  `| Vitest | ${vitest.passed} | ${vitest.skipped} | ${vitest.failed} | ${vitest.total} | ${stamp()} |`,
  `| Playwright | ${e2e.passed} | ${e2e.skipped} | ${e2e.failed} | ${e2e.total} | ${stamp()} |`,
  END,
].join('\n');

const current = fs.existsSync(METRICS) ? fs.readFileSync(METRICS, 'utf8') : '# 批次优化度量\n';

if (check) {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start < 0 || end < 0) {
    console.error('metrics:tests block not found in docs/metrics.md');
    process.exit(1);
  }
  const existing = current.slice(start, end + END.length);
  // 采集时间列不参与比较（每次运行都会变）
  const normalize = (text) => text.replace(/\| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \|/g, '| <ts> |');
  if (normalize(existing) !== normalize(block)) {
    console.error('metrics:tests block is stale; run: node tools/measure-tests.mjs --write');
    process.exit(1);
  }
  console.log('metrics tests block OK');
  process.exit(0);
}

let next;
const start = current.indexOf(START);
const end = current.indexOf(END);
if (start >= 0 && end >= 0) {
  next = current.slice(0, start) + block + current.slice(end + END.length);
} else {
  next = current.trimEnd() + '\n\n## 用例统计\n\n' + block + '\n';
}
fs.mkdirSync(path.dirname(METRICS), { recursive: true });
fs.writeFileSync(METRICS, next, 'utf8');
console.log('metrics tests block written');
console.log(block);