// R-P6-07（门禁 ③）：500 行硬阈值 + 豁免清单「只减不增」。
//   node tools/verify-line-count.mjs --check
// 规则：① 超标文件必须在豁免清单中，否则 LINE_COUNT_UNLISTED；
//      ② 豁免条目行数不得超过清单记录，否则 LINE_COUNT_GROWTH；
//      ③ 清单条目数不得超过 maxEntries，否则 LINE_COUNT_EXEMPT_GROWTH；
//      ④ 已回落到阈值内的条目只提示（提示维护者下调清单，不失败）。
// 退出码：0 通过；1 违规；2 参数错误。

import fs from 'node:fs';
import path from 'node:path';

const LIMIT = 500;
const ROOT = process.cwd();
const args = process.argv.slice(2);
if (!args.includes('--check')) {
  console.error('usage: node tools/verify-line-count.mjs --check');
  process.exit(2);
}

const EXEMPT_FILE = path.join(ROOT, 'tools', 'line-count-exempt.json');
const exempt = JSON.parse(fs.readFileSync(EXEMPT_FILE, 'utf8'));
const exemptMap = new Map(exempt.entries.map((e) => [e.file, e]));

const SCAN_ROOTS = ['app', 'node', 'tools', 'test'];
const SCAN_FILES = ['main.js', 'server.js', 'build.mjs', 'gen.js'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'releases', 'test-results']);
const EXT = /\.(js|mjs|vue|css)$/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (EXT.test(entry.name)) {
      out.push(full);
    }
  }
}

const files = [];
for (const root of SCAN_ROOTS) walk(path.join(ROOT, root), files);
for (const rel of SCAN_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) files.push(full);
}

function toRel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

const violations = [];
const notices = [];
let overLimit = 0;

for (const file of files) {
  const rel = toRel(file);
  if (!EXT.test(rel)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n').length;
  if (lines <= LIMIT) continue;
  overLimit += 1;
  const entry = exemptMap.get(rel);
  if (!entry) {
    violations.push(`LINE_COUNT_UNLISTED: ${rel} (${lines} > ${LIMIT})`);
    continue;
  }
  if (lines > entry.lines) {
    violations.push(`LINE_COUNT_GROWTH: ${rel} (${lines} > exempt ${entry.lines})`);
  }
}

for (const entry of exempt.entries) {
  const full = path.join(ROOT, entry.file);
  if (!fs.existsSync(full)) {
    notices.push(`NOTICE: exempt entry missing file: ${entry.file}`);
    continue;
  }
  const lines = fs.readFileSync(full, 'utf8').split('\n').length;
  if (lines <= LIMIT) {
    notices.push(`NOTICE: ${entry.file} now ${lines} lines (<= ${LIMIT}); consider removing exemption`);
  }
}

if (exempt.entries.length > exempt.maxEntries) {
  violations.push(
    `LINE_COUNT_EXEMPT_GROWTH: ${exempt.entries.length} > maxEntries ${exempt.maxEntries}`
  );
}

for (const n of notices) console.log(n);
console.log(`line-count: scanned ${files.length} files, over-limit ${overLimit}, exempt ${exempt.entries.length}`);

if (violations.length) {
  for (const v of violations) console.error(v);
  console.error(`FAIL: ${violations.length} violation(s)`);
  process.exit(1);
}
console.log('PASS: line count OK');