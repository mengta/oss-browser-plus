#!/usr/bin/env node
// 工具链配置结构断言（tasks 2.9 落地 A1/A2/A6；批次二 3.6 扩展 A3/A4/A5）
// 设计依据：.codeartsdoer/specs/toolchain-modernization/design.md I-6

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require2 = createRequire(path.join(process.cwd(), 'package.json'));
const results = [];
let allOk = true;

function check(id, fn) {
  let ok = false;
  try {
    ok = fn() === true;
  } catch (e) {
    results.push(`FAIL ${id} (${e.message})`);
    allOk = allOk && false;
    return;
  }
  results.push(`${ok ? 'OK' : 'FAIL'} ${id}`);
  allOk = allOk && ok;
}

// A1：eslint.config.js 存在且可 require（CJS 数组）
check('A1', () => {
  fs.accessSync('eslint.config.js');
  const c = require2(path.resolve('eslint.config.js'));
  return Array.isArray(c) && c.length >= 3;
});

// A2：无 .eslintrc.json（单一来源，spec 5.1.1-8）
check('A2', () => !fs.existsSync('.eslintrc.json'));

// A6：devDependencies 无 babel-eslint 且 eslint 为 9.x（tasks 2.1）
check('A6', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dev = pkg.devDependencies || {};
  if ('babel-eslint' in dev) return false;
  const v = String(dev.eslint || '');
  return /^(\^|~)?9\./.test(v);
});

// A3：package.json 无 husky 旧块且 scripts.prepare === 'husky'（spec 5.2.1-7/4.4-1）
check('A3', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if ('husky' in pkg) return false;
  return pkg.scripts && pkg.scripts.prepare === 'husky';
});

// A4：.husky/pre-commit 存在且内容含 lint-staged（D-05/I-3）
check('A4', () => {
  const content = fs.readFileSync(path.join('.husky', 'pre-commit'), 'utf8');
  return content.includes('lint-staged');
});

// A5：lint-staged 配置不含 git add（D-06/I-5）
check('A5', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return !JSON.stringify(pkg['lint-staged'] || {}).includes('git add');
});

console.log(results.join('\n'));
console.log(allOk ? 'TOOLCHAIN-ASSERT-OK' : 'TOOLCHAIN-ASSERT-FAILED');
process.exit(allOk ? 0 : 1);