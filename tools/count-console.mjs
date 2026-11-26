// R-P4-04（门禁 ③ 的日志侧）：统计主进程 console.log/debug/info 使用量。
//   node tools/count-console.mjs [--fail-on-hit]
// 输出形如 console.log=N；--fail-on-hit 且 N > 0 时退出 1。
// 范围：main.js、server.js、node/**（排除 node_modules/dist/build/releases 与 crc64 生成代码）。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const failOnHit = args.includes('--fail-on-hit');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'releases', 'test-results', 'crc64', 'test']);
// logger 自身必须直写控制台（不可自举到 logger）
const SKIP_FILES = new Set(['node/lib/logger.js']);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
}

const files = [];
for (const rel of ['main.js', 'server.js']) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) files.push(full);
}
walk(path.join(ROOT, 'node'), files);

const counts = { 'console.log': 0, 'console.debug': 0, 'console.info': 0 };
const hits = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (SKIP_FILES.has(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const key of Object.keys(counts)) {
      if (line.includes(key)) {
        counts[key] += 1;
        hits.push(`${path.relative(ROOT, file).split(path.sep).join('/')}:${i + 1} ${key}`);
      }
    }
  }
}

for (const [key, value] of Object.entries(counts)) {
  console.log(`${key}=${value}`);
}
console.log(`files=${files.length}`);

if (failOnHit && counts['console.log'] > 0) {
  for (const hit of hits.filter((h) => h.includes('console.log'))) console.error(hit);
  console.error(`FAIL: console.log=${counts['console.log']}`);
  process.exit(1);
}