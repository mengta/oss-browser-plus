#!/usr/bin/env node
'use strict';

// build.mjs — esbuild + Node 原生构建脚本（替代 gulp ~3.5.5 全部构建任务，升级文档 Phase 1）
// 复刻 gulpfile.js 14 个任务的产物布局契约（dist 布局不得变化）：
//   js → dist/app.js；templates → dist/templates.js（$templateCache standalone）；
//   css → dist/app.css；libJS → dist/lib.js（vendor 顺序 + codemirror modes 动态扫描）；
//   libCSS → dist/css/lib.css；copy-fonts → dist/fonts；copy-icons → dist/icons；
//   copy-node → dist/node；copy-docs → dist/release-notes；copy-static → dist/static；
//   copy-index → dist 根 6 项；gen-package → dist/package.json（+ --dist-install 时 npm install --omit=dev）；
//   remove-redundant → 删除 dist/node_modules 的 protobufjs/aliyun-sdk dist 子目录；
//   watch → fs.watch 监听 app/ 与 static/、node/ 触发对应任务。
// 用法：node build.mjs [--watch] [--dist-install]

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import * as esbuild from 'esbuild';
import vuePlugin from './tools/esbuild-vue-plugin.mjs';
import { crc64Filter } from './tools/build-filters.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const OPTS = {
  watch: args.includes('--watch'),
  distInstall: args.includes('--dist-install'),
};

// P1（R-P1-01）：构建目标平台解析。--target 优先，其次 PLATFORM/ARCH 环境变量，最后本机。
// 非法格式显式失败（非 0），不静默回退本机平台。
function resolveTarget() {
  const explicit = args.find((a) => a.startsWith('--target='));
  let raw = explicit ? explicit.slice('--target='.length) : '';
  if (!raw && process.env.PLATFORM && process.env.ARCH) {
    raw = `${process.env.PLATFORM}-${process.env.ARCH}`;
  }
  if (!raw) {
    return { platform: process.platform, arch: process.arch };
  }
  const matched = /^(win32|linux|darwin)-(x64|arm64|ia32)$/.exec(raw);
  if (!matched) {
    console.error(
      `BUILD_TARGET_INVALID: "${raw}" (expected <win32|linux|darwin>-<x64|arm64|ia32>)`
    );
    process.exit(1);
  }
  return { platform: matched[1], arch: matched[2] };
}

const TARGET = resolveTarget();
const TARGET_DIR = `${TARGET.platform}-${TARGET.arch}`;

function walk(dir, filter) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      out.push(...walk(p, filter));
    } else if (!filter || filter(p)) {
      out.push(p);
    }
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function concatWrite(files, dest, { transform } = {}) {
  let out = '';
  for (const f of files) {
    let code = fs.readFileSync(f, 'utf8');
    if (transform) code = transform(code, f);
    out += code;
    if (!out.endsWith('\n')) out += '\n';
    out += '\n';
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  console.log('--done', toPosix(path.relative(ROOT, dest)), `(${files.length} files)`);
  return dest;
}

// ---------- 任务：js（app.js） ----------
async function taskAppJS() {
  // B4-07：Angular 侧不再打包（Vue bundle 输出 dist/app.js）
}


// ---------- 任务：css（app.css） ----------
function taskAppCSS() {
  console.log('--rebuilding app.css...');
  const files = walk(path.join(ROOT, 'app'), (p) => p.endsWith('.css'));
  // P1（R-P1-04）：bootstrap 子集先出，vscode-theme 最后，保证主题色覆盖
  const order = (p) => {
    if (p.endsWith('bootstrap-subset.css')) return 0;
    if (p.endsWith('vscode-theme.css')) return 2;
    return 1;
  };
  files.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  concatWrite(files, path.join(DIST, 'app.css'));
}


// ---------- 任务：copy-icons / copy-node / copy-docs / copy-static ----------
function copyTree(srcDir, destDir, { filter } = {}) {
  if (!fs.existsSync(srcDir)) return;
  for (const f of walk(srcDir)) {
    const rel = toPosix(path.relative(srcDir, f));
    if (filter && !filter(rel)) continue;
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }
  console.log('--done', toPosix(path.relative(ROOT, destDir)));
}
function taskCopyIcons() {
  copyTree(path.join(ROOT, 'app', 'icons'), path.join(DIST, 'icons'));
}

// P1（R-P1-02）：crc64 裁剪谓词抽到 tools/build-filters.mjs（可单测）
function taskCopyNode() {
  copyTree(path.join(ROOT, 'node'), path.join(DIST, 'node'), {
    filter: (rel) => crc64Filter(rel, TARGET_DIR),
  });
}
function taskCopyDocs() {
  copyTree(path.join(ROOT, 'release-notes'), path.join(DIST, 'release-notes'));
}
function taskCopyStatic() {
  // P1（R-P1-05）：静态资源白名单（jquery/diff_match_patch 等死资产不再复制）
  const allowed = new Set(['flv.js', 'flv-player.html', 'soft-link.svg']);
  copyTree(path.join(ROOT, 'static'), path.join(DIST, 'static'), {
    filter: (rel) => allowed.has(rel),
  });
}

// ---------- 任务：copy-index ----------
function taskCopyIndex() {
  const list = [
    './app/index.html',
    './main.js',
    './server.js',

    './release-notes.md',

  ];
  for (const rel of list) {
    if (rel.endsWith('/*.js')) {
      const dir = path.join(ROOT, rel.slice(0, -5));
      for (const f of walk(dir)) fs.copyFileSync(f, path.join(DIST, path.basename(f)));
    } else {
      const abs = path.join(ROOT, rel);
      if (fs.existsSync(abs)) fs.copyFileSync(abs, path.join(DIST, path.basename(rel)));
    }
  }
  console.log('--done copy-index');
  recalcCspHashes();
}

function recalcCspHashes() {
  const file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const hashes = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html))) {
    hashes.push("'sha256-" + crypto.createHash('sha256').update(match[1], 'utf8').digest('base64') + "'");
  }
  if (hashes.length === 0) {
    console.log('--done CSP hashes: 0');
    return;
  }
  html = html.replace(
    /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/,
    (all, head, csp, tail) => {
      const next = csp.replace(/script-src [^;]*/, 'script-src ' + ["'self'"].concat(hashes).join(' '));
      return head + next + tail;
    }
  );
  fs.writeFileSync(file, html);
  console.log('--done CSP hashes (' + hashes.length + ')');
}

// ---------- 任务：gen-package（D4：npm install --omit=dev 替代 yarn） ----------
function taskGenPackage() {
  const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  delete info.devDependencies;
  delete info.ava;
  // electron-builder 配置段与构建脚本不入应用包（builder 拒绝 app 包内含 build 字段）
  delete info.build;
  delete info.scripts;
  info.scripts = { start: 'electron .' };
  info.main = 'main.js';
  fs.writeFileSync(path.join(DIST, 'package.json'), JSON.stringify(info, null, 2));
  console.log('--done dist/package.json');
  if (OPTS.distInstall) {
    console.log('--dist install (npm install --omit=dev)...');
    const r = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: DIST,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) {
      throw new Error('dist npm install failed with code ' + r.status);
    }
    taskRemoveRedundant();
  }
}

// ---------- 任务：remove-redundant ----------
function taskRemoveRedundant() {
  for (const rel of ['protobufjs/dist', 'aliyun-sdk/dist']) {
    const p = path.join(DIST, 'node_modules', ...rel.split('/'));
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      console.log('--removed', toPosix(path.relative(ROOT, p)));
    }
  }
}

// ---------- 任务：preload（app/preload/net-bridge.js → dist/preload.js） ----------
async function taskPreload() {
  console.log('--rebuilding preload.js...');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'app', 'preload', 'net-bridge.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile: path.join(DIST, 'preload.js'),
    external: ['electron', 'ali-oss', 'aliyun-sdk', 'nodemailer', 'electron-log'],
    logLevel: 'silent',
  });
  console.log('--done dist/preload.js');
}


// ---------- 任务：renderer（app/renderer/main.js → dist/renderer.js，Vue 3 SFC） ----------
async function taskRenderer() {
  console.log('--rebuilding app.js (Vue bundle)...');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'app', 'renderer', 'main.js')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome120',
    outfile: path.join(DIST, 'app.js'),
    plugins: [vuePlugin()],
    loader: { '.svg': 'text', '.css': 'css' },
    // P1（R-P1-03）：非 watch 构建启用压缩；不 drop console（保留错误诊断）
    minify: !OPTS.watch,
    legalComments: 'none',
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(OPTS.watch ? 'development' : 'production'),
    },
    logLevel: 'silent',
  });
  console.log('--done dist/app.js');
}

// ---------- 任务：watch ----------
function debounce(fn, ms = 200) {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}
function taskWatch() {
  console.log('--watching app/ static/ node/ (Ctrl+C to exit)');
  const rebuildJS = debounce(() => taskAppJS().catch((e) => console.error(e)));

  const rebuildCSS = debounce(taskAppCSS);
  const reCopyIndex = debounce(taskCopyIndex);
  const reCopyStatic = debounce(taskCopyStatic);
  const reCopyNode = debounce(taskCopyNode);
  const rePreload = debounce(() => taskPreload().catch((e) => console.error(e)));
  const reRenderer = debounce(() => taskRenderer().catch((e) => console.error(e)));


  function watchDir(dir, onChange) {
    if (!fs.existsSync(dir)) return;
    try {
      fs.watch(dir, { recursive: process.platform === 'win32' }, (event, filename) => {
        if (!filename) return;
        onChange(toPosix(filename));
      });
    } catch {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) watchDir(p, onChange);
      }
    }
  }

  watchDir(path.join(ROOT, 'app'), (name) => {
    if (name.startsWith('preload/') && name.endsWith('.js')) rePreload();
    else if (
      name.startsWith('renderer/') &&
      (name.endsWith('.js') || name.endsWith('.vue') || name.endsWith('.css'))
    )
      reRenderer();
    else if (name.endsWith('.js') && !name.endsWith('_test.js')) rebuildJS();
    else if (name.endsWith('.html') && name !== 'index.html') reCopyStatic();
    else if (name.endsWith('.css')) rebuildCSS();
    else if (name === 'index.html') reCopyIndex();
  });
  watchDir(path.join(ROOT, 'static'), reCopyStatic);
  watchDir(path.join(ROOT, 'node'), reCopyNode);
  watchDir(path.join(ROOT, 'main.js'.slice(0, 0) || '.'), (name) => {
    if (name === 'main.js' || name === 'server.js') reCopyIndex();
  });
}

// ---------- build 主流程 ----------
async function runBuild() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  console.log(`--target ${TARGET_DIR}`);
  taskAppCSS();
  taskCopyIndex();
  taskCopyNode();
  taskCopyDocs();
  taskCopyIcons();
  taskCopyStatic();
  taskGenPackage();
  await taskPreload();
fs.copyFileSync(
    path.join(DIST, 'package.json'),
    path.join(DIST, 'node', 'capabilities', 'services', 'package.json')
  );
  await taskRenderer();
  if (!OPTS.distInstall) taskRemoveRedundant();
  console.log('--build complete');
}

(async () => {
  try {
    await runBuild();
    if (OPTS.watch) taskWatch();
  } catch (e) {
    console.error('[build] FAILED:', e);
    process.exit(1);
  }
})();