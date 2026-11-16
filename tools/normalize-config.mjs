#!/usr/bin/env node
// 归一化 --print-config 输出（eslintrc / flat 两种格式 → 可比形态）
// 用法：node tools/normalize-config.mjs <print-config.json>
// 输出：stdout JSON { rules(非off), languageOptions:{ecmaVersion,sourceType}, globals(排序键) }
// 设计依据：.codeartsdoer/specs/toolchain-modernization/design.md 2.1.3-（3）权威对齐法、tasks 2.6

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/normalize-config.mjs <print-config.json>');
  process.exit(2);
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));

// rules 归一化 v2：
// 1) 过滤 off 项（eslintrc 输出含全部 214 条含 99 条 off；flat 仅显式声明的非 off——未声明即 off，语义等效）
// 2) severity 统一字符串表示（eslintrc 输出 "error" 字符串风格；flat 的 print-config 输出数字 2——两者仅表示法差异）
// 3) options 分离输出（flat 的 print-config 会将 es5 基线的默认 options 显式化，如 no-undef 的 {"typeof":false}——
//    语义等效，属表示法差异；单独列清单供逐条登记，不与 severity 混比）
const rules = {};
const rulesSeverity = {};
const rulesOptions = {};
for (const [name, value] of Object.entries(raw.rules || {})) {
  const arr = Array.isArray(value) ? value : [value];
  const sev = arr[0];
  if (sev === 0 || sev === 'off') {
    continue;
  }
  const severity =
    sev === 1 || sev === 'warn' ? 'warn' : 'error';
  const options = arr.slice(1);
  rules[name] = { severity, options };
  rulesSeverity[name] = severity;
  if (options.length > 0) {
    rulesOptions[name] = options;
  }
}

// languageOptions 归一化：eslintrc 用 parserOptions，flat 用 languageOptions
const languageOptions = {
  ecmaVersion:
    (raw.languageOptions && raw.languageOptions.ecmaVersion) ||
    (raw.parserOptions && raw.parserOptions.ecmaVersion) ||
    null,
  sourceType:
    (raw.languageOptions && raw.languageOptions.sourceType) ||
    (raw.parserOptions && raw.parserOptions.sourceType) ||
    null,
};

// globals 归一化：排序键列表（env 展开的内置 globals 与自定义 globals 均含）
const globals = Object.keys(raw.globals || {}).sort();

console.log(
  JSON.stringify(
    { rules, rulesSeverity, rulesOptions, languageOptions, globals },
    null,
    2
  )
);