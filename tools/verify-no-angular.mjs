// P6（R-P6-01 · 门禁）：断言目标文件不再依赖 Angular（module/$q/$state/Toast/AuthInfo/global.angular）。
// 白名单按子批次收窄：6a 后移出 sts.js；6b 后移出 ram.js；6c 后清空（dispatch.js 同时清零）。
//   node tools/verify-no-angular.mjs
// 退出码：0 通过；1 白名单外命中；2 参数错误。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TARGETS = [
  'node/capabilities/services/sts.js',
  'node/capabilities/services/ram.js',
  'node/capabilities/services/oss2.js',
  'node/capabilities/dispatch.js',
];

// 尚未完成去化的文件（6a 后：sts 已移出；6b 后：ram 已移出）
const ALLOWLIST = new Set([
  'node/capabilities/services/oss2.js',
  'node/capabilities/dispatch.js',
]);

const PATTERNS = [
  { name: 'angular.module', re: /angular\.module\s*\(/g },
  { name: 'global.angular', re: /global\.angular/g },
  { name: '\$q.defer', re: /\$q\.defer\s*\(/g },
  { name: '\$state.go', re: /\$state\.go\s*\(/g },
  { name: 'AuthInfo.get', re: /AuthInfo\.get\s*\(/g },
  { name: 'Toast.', re: /\bToast\.(error|success|info|warning)\s*\(/g },
];

const violations = [];
const notices = [];

for (const rel of TARGETS) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    violations.push(`NO_ANGULAR_MISSING: ${rel}`);
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  const hits = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    const matches = text.match(p.re);
    if (matches) hits.push(`${p.name}×${matches.length}`);
  }
  if (hits.length === 0) continue;
  if (ALLOWLIST.has(rel)) {
    notices.push(`ALLOWLIST: ${rel} → ${hits.join(', ')}`);
  } else {
    violations.push(`NO_ANGULAR_HIT: ${rel} → ${hits.join(', ')}`);
  }
}

for (const n of notices) console.log(n);
console.log(`verify-no-angular: targets ${TARGETS.length}, allowlist ${ALLOWLIST.size}`);

if (violations.length) {
  for (const v of violations) console.error(v);
  console.error(`FAIL: ${violations.length} violation(s)`);
  process.exit(1);
}
console.log('PASS: no angular dependency outside allowlist');