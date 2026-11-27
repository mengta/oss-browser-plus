// P6（R-P6-01 · 门禁）：断言目标文件不再依赖 Angular（module/$q/$state/Toast/AuthInfo/global.angular）。
// P6c 收尾：白名单清空，oss2.js 已拆分为 services/oss/ 目录（整目录扫描）。
//   node tools/verify-no-angular.mjs
// 退出码：0 通过；1 白名单外命中/目标缺失；2 参数错误。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TARGETS = [
  'node/capabilities/services/sts.js',
  'node/capabilities/services/ram.js',
  'node/capabilities/services/oss',
  'node/capabilities/dispatch.js',
];

// 6c 完成后不再有允许清单
const ALLOWLIST = new Set();

const PATTERNS = [
  { name: 'angular.module', re: /angular\.module\s*\(/g },
  { name: 'global.angular', re: /global\.angular/g },
  { name: '\$q.defer', re: /\$q\.defer\s*\(/g },
  { name: '\$state.go', re: /\$state\.go\s*\(/g },
  { name: 'AuthInfo.get', re: /AuthInfo\.get\s*\(/g },
  { name: 'Toast.', re: /\bToast\.(error|success|info|warning)\s*\(/g },
];

function expand(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  if (fs.statSync(full).isDirectory()) {
    return fs
      .readdirSync(full)
      .filter((name) => name.endsWith('.js'))
      .map((name) => path.join(rel, name));
  }
  return [rel];
}

const violations = [];
const notices = [];
let fileCount = 0;

for (const rel of TARGETS) {
  const files = expand(rel);
  if (!files) {
    violations.push(`NO_ANGULAR_MISSING: ${rel}`);
    continue;
  }
  for (const file of files) {
    fileCount += 1;
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const hits = [];
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      const matches = text.match(p.re);
      if (matches) hits.push(`${p.name}×${matches.length}`);
    }
    if (hits.length === 0) continue;
    if (ALLOWLIST.has(file)) {
      notices.push(`ALLOWLIST: ${file} → ${hits.join(', ')}`);
    } else {
      violations.push(`NO_ANGULAR_HIT: ${file} → ${hits.join(', ')}`);
    }
  }
}

for (const n of notices) console.log(n);
console.log(`verify-no-angular: files ${fileCount}, allowlist ${ALLOWLIST.size}`);

if (violations.length) {
  for (const v of violations) console.error(v);
  console.error(`FAIL: ${violations.length} violation(s)`);
  process.exit(1);
}
console.log('PASS: no angular dependency outside allowlist');