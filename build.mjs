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
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const OPTS = {
  watch: args.includes('--watch'),
  distInstall: args.includes('--dist-install'),
};

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
  console.log('--rebuilding app.js...');
  const files = walk(path.join(ROOT, 'app'), (p) => p.endsWith('.js') && !p.endsWith('_test.js'));
  concatWrite(files, path.join(DIST, 'app.js'), {
    // 目标 Chromium（Electron 45）原生支持 ES2020+：不转译，仅经 esbuild 做语法标准化
    transform: (code) => {
      const r = esbuild.transformSync(code, { loader: 'js', target: 'esnext' });
      return r.code;
    },
  });
}

// ---------- 任务：templates（templates.js，$templateCache standalone） ----------
function taskTemplates() {
  console.log('--rebuilding templates.js...');
  const files = walk(path.join(ROOT, 'app'), (p) => p.endsWith('.html') && toPosix(p) !== 'app/index.html'.replace(/^\//, '') && !p.endsWith(path.join('app', 'index.html')));
  const entries = files
    .map((f) => {
      const key = toPosix(path.relative(path.join(ROOT, 'app'), f));
      const content = fs.readFileSync(f, 'utf8');
      return `  $templateCache.put(${JSON.stringify(key)}, ${JSON.stringify(content)});`;
    })
    .join('\n');
  const code =
    `angular.module("templates", []).run(["$templateCache", function($templateCache) {\n` +
    entries +
    `\n}]);\n`;
  fs.writeFileSync(path.join(DIST, 'templates.js'), code);
  console.log('--done dist/templates.js');
}

// ---------- 任务：css（app.css） ----------
function taskAppCSS() {
  console.log('--rebuilding app.css...');
  const files = walk(path.join(ROOT, 'app'), (p) => p.endsWith('.css'));
  concatWrite(files, path.join(DIST, 'app.css'));
}

// ---------- 任务：libJS（lib.js，vendor 顺序与 gulpfile.js:97-129 一致） ----------
function taskLibJS() {
  const vendorList = [
    './node_modules/jquery/dist/jquery.js',
    './node_modules/jquery.qrcode/jquery.qrcode.min.js',
    './node_modules/moment/min/moment-with-locales.js',
    './node_modules/bootstrap/dist/js/bootstrap.js',
    './node_modules/angular/angular.js',
    './node_modules/angular-sanitize/angular-sanitize.js',
    './node_modules/angular-ui-router/release/angular-ui-router.js',
    './node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
    './node_modules/showdown/dist/showdown.js',
    './node_modules/clipboard/dist/clipboard.min.js',
    './vendor/diff_match_patch.js',
    './vendor/angular-translate.min.js',
    './node_modules/angular-ui-codemirror/src/ui-codemirror.js',
    './node_modules/codemirror/lib/codemirror.js',
    './node_modules/codemirror/addon/mode/simple.js',
    './node_modules/codemirror/addon/mode/merge/merge.js',
    './node_modules/codemirror/mode/meta.js',
    './node_modules/angular-bootstrap-contextmenu/contextMenu.js',
  ];
  const files = [];
  const missing = [];
  for (const rel of vendorList) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) files.push(abs);
    else missing.push(rel);
  }
  // codemirror modes 动态扫描（等价复刻 fs.readdirSync("./node_modules/codemirror/mode/")）
  const modePath = path.join(ROOT, 'node_modules', 'codemirror', 'mode');
  if (fs.existsSync(modePath)) {
    for (const name of fs.readdirSync(modePath).sort()) {
      const modeDir = path.join(modePath, name);
      if (!fs.statSync(modeDir).isDirectory()) continue;
      for (const js of fs.readdirSync(modeDir).sort()) {
        if (js.endsWith('.js')) files.push(path.join(modeDir, js));
      }
    }
  }
  if (missing.length) {
    console.warn('[libJS] missing vendor files:', missing.join(', '));
  }
  concatWrite(files, path.join(DIST, 'lib.js'));
}

// ---------- 任务：libCSS（css/lib.css） ----------
function taskLibCSS() {
  const list = [
    './node_modules/bootstrap/dist/css/bootstrap.css',
    './node_modules/font-awesome/css/font-awesome.css',
    './node_modules/codemirror/lib/codemirror.css',
    './node_modules/codemirror/addon/mode/merge/merge.css',
  ];
  const files = list.map((r) => path.join(ROOT, r)).filter((f) => fs.existsSync(f));
  concatWrite(files, path.join(DIST, 'css', 'lib.css'));
}

// ---------- 任务：copy-fonts ----------
function taskCopyFonts() {
  const dirs = [
    path.join(ROOT, 'node_modules', 'bootstrap', 'fonts'),
    path.join(ROOT, 'node_modules', 'font-awesome', 'fonts'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of walk(d)) {
      const dest = path.join(DIST, 'fonts', path.basename(f));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(f, dest);
    }
  }
  console.log('--done dist/fonts');
}

// ---------- 任务：copy-icons / copy-node / copy-docs / copy-static ----------
function copyTree(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  for (const f of walk(srcDir)) {
    const dest = path.join(destDir, path.relative(srcDir, f));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }
  console.log('--done', toPosix(path.relative(ROOT, destDir)));
}
function taskCopyIcons() {
  copyTree(path.join(ROOT, 'app', 'icons'), path.join(DIST, 'icons'));
}
function taskCopyNode() {
  copyTree(path.join(ROOT, 'node'), path.join(DIST, 'node'));
}
function taskCopyDocs() {
  copyTree(path.join(ROOT, 'release-notes'), path.join(DIST, 'release-notes'));
}
function taskCopyStatic() {
  copyTree(path.join(ROOT, 'static'), path.join(DIST, 'static'));
}

// ---------- 任务：copy-index ----------
function taskCopyIndex() {
  const list = [
    './app/index.html',
    './main.js',
    './server.js',
    './vendor/*.js',
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
  const rebuildTpl = debounce(taskTemplates);
  const rebuildCSS = debounce(taskAppCSS);
  const reCopyIndex = debounce(taskCopyIndex);
  const reCopyStatic = debounce(taskCopyStatic);
  const reCopyNode = debounce(taskCopyNode);

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
    if (name.endsWith('.js') && !name.endsWith('_test.js')) rebuildJS();
    else if (name.endsWith('.html') && name !== 'index.html') rebuildTpl();
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
  await taskAppJS();
  taskTemplates();
  taskAppCSS();
  taskCopyIndex();
  taskLibJS();
  taskLibCSS();
  taskCopyFonts();
  taskCopyNode();
  taskCopyDocs();
  taskCopyIcons();
  taskCopyStatic();
  taskGenPackage();
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