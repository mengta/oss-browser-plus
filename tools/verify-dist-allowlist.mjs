// P1（R-P1-05 · 门禁 ⑧）：dist 目录白名单校验。
//   node tools/verify-dist-allowlist.mjs [--dist=dist] [--target=win32-x64]
// 校验：① 顶层白名单（多余文件 = DIST_EXTRA_FILE）；② 必需项缺失 = DIST_MISSING_FILE；
//      ③ 死资产必须不存在 = DIST_FORBIDDEN_FILE；④ crc64 仅保留目标平台与 pure-js；
//      ⑤ index.html 本地引用必须存在。
// 退出码：0 通过；1 违规；2 参数错误。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const argOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};

const DIST = path.resolve(ROOT, argOf('dist') || 'dist');
let target = argOf('target');
if (!target && process.env.PLATFORM && process.env.ARCH) {
  target = `${process.env.PLATFORM}-${process.env.ARCH}`;
}
if (!target) target = `${process.platform}-${process.arch}`;
if (!/^(win32|linux|darwin)-(x64|arm64|ia32)$/.test(target)) {
  console.error(`DIST_TARGET_INVALID: ${target}`);
  process.exit(2);
}

const ALLOWED_TOP = new Set([
  'app.css',
  'app.js',
  'icons',
  'index.html',
  'main.js',
  'node',
  'node_modules',
  'package.json',
  'package-lock.json',
  'preload.js',
  'release-notes',
  'server.js',
  'static',
]);

const REQUIRED_TOP = [
  'app.css',
  'app.js',
  'icons',
  'index.html',
  'main.js',
  'node',
  'package.json',
  'preload.js',
  'release-notes',
  'server.js',
  'static',
];

const FORBIDDEN = [
  'lib.js',
  'templates.js',
  'aliyun-sdk-oss.js',
  'diff_match_patch.js',
  'css/lib.css',
  'fonts',
  'static/jquery.min.js',
  'node/crc64/cpp-addon',
];

const errors = [];
if (!fs.existsSync(DIST)) {
  console.error(`DIST_MISSING_FILE: ${DIST} not found`);
  process.exit(1);
}

for (const name of fs.readdirSync(DIST)) {
  if (!ALLOWED_TOP.has(name)) {
    errors.push(`DIST_EXTRA_FILE: ${name}`);
  }
}

for (const name of REQUIRED_TOP) {
  if (!fs.existsSync(path.join(DIST, name))) {
    errors.push(`DIST_MISSING_FILE: ${name}`);
  }
}

for (const rel of FORBIDDEN) {
  if (fs.existsSync(path.join(DIST, ...rel.split('/')))) {
    errors.push(`DIST_FORBIDDEN_FILE: ${rel}`);
  }
}

const crc64Dir = path.join(DIST, 'node', 'crc64');
if (fs.existsSync(crc64Dir)) {
  const prebuildLib = path.join(crc64Dir, 'electron-crc64-prebuild', 'lib');
  if (fs.existsSync(prebuildLib)) {
    for (const name of fs.readdirSync(prebuildLib)) {
      if (name === 'index.js') continue;
      if (name !== target) {
        errors.push(`DIST_EXTRA_FILE: node/crc64/electron-crc64-prebuild/lib/${name}`);
      }
    }
  }
  const required = ['index.js', 'fork.js', 'pure-js'];
  for (const rel of required) {
    if (!fs.existsSync(path.join(crc64Dir, rel))) {
      errors.push(`DIST_MISSING_FILE: node/crc64/${rel}`);
    }
  }
}

const indexHtml = path.join(DIST, 'index.html');
if (fs.existsSync(indexHtml)) {
  const html = fs.readFileSync(indexHtml, 'utf8');
  const refs = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) refs.push(match[1]);
  for (const ref of refs) {
    if (/^(https?:|data:|#|javascript:)/i.test(ref)) continue;
    const abs = path.join(DIST, ref.replace(/^\.\//, ''));
    if (!fs.existsSync(abs)) {
      errors.push(`DIST_MISSING_FILE: index.html -> ${ref}`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`FAIL: ${errors.length} violation(s) (target=${target})`);
  process.exit(1);
}
console.log(`PASS: dist allowlist OK (target=${target})`);