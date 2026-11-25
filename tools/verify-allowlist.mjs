#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const violations = [];
const notes = [];

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function countHits(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inBlock = false;
  let requireHits = 0;
  let processHits = 0;
  let ipcHits = 0;
  for (const raw of lines) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end < 0) continue;
      line = line.slice(end + 2);
      inBlock = false;
    }
    const open = line.indexOf('/*');
    if (open >= 0) {
      const close = line.indexOf('*/', open + 2);
      if (close < 0) {
        line = line.slice(0, open);
        inBlock = true;
      } else {
        line = line.slice(0, open) + line.slice(close + 2);
      }
    }
    const comment = line.indexOf('//');
    if (comment >= 0) line = line.slice(0, comment);
    if (/\brequire\s*\(/.test(line)) requireHits += 1;
    if (/\bprocess\s*\./.test(line)) processHits += 1;
    if (/\bipcRenderer\s*\.\s*(send|on|invoke|sendSync)\s*\(/.test(line)) ipcHits += 1;
  }
  return { require: requireHits, process: processHits, ipcRenderer: ipcHits };
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadManifest() {
  const target = path.join(ROOT, 'app/preload/api-manifest.js');
  delete require.cache[require.resolve(target)];
  return require(target);
}

function ruleRendererNodeDirect() {
  const baselinePath = path.join(ROOT, 'tools/allowlist-baseline.json');
  const baseline = fs.existsSync(baselinePath) ? loadJson(baselinePath) : { renderer: {} };
  const allowed = baseline.renderer || {};
  const files = walk(path.join(ROOT, 'app')).filter((f) => {
    const r = rel(f);
    return r.startsWith('app/') && !r.startsWith('app/preload/') && /\.(js|html)$/.test(f);
  });
  const totals = { require: 0, process: 0, ipcRenderer: 0 };
  for (const file of files) {
    const key = rel(file);
    const counts = countHits(file);
    const cap = allowed[key] || { require: 0, process: 0, ipcRenderer: 0 };
    for (const kind of Object.keys(totals)) {
      if (counts[kind] > (cap[kind] || 0)) {
        violations.push(`[R1 renderer-${kind}] ${key}: 实测 ${counts[kind]} > 豁免 ${cap[kind] || 0}`);
      }
      totals[kind] += counts[kind];
    }
  }
  for (const key of Object.keys(allowed)) {
    if (!fs.existsSync(path.join(ROOT, key))) {
      notes.push(`[R1 baseline] ${key} 已不存在，请下调豁免基线`);
    }
  }
  notes.push(`[R1] 渲染层实测合计 require=${totals.require} process=${totals.process} ipcRenderer=${totals.ipcRenderer}`);
  return totals;
}

function ruleExposureSurface() {
  const bridgePath = path.join(ROOT, 'app/preload/net-bridge.js');
  if (!fs.existsSync(bridgePath)) {
    violations.push('[R2] 缺少 app/preload/net-bridge.js');
    return;
  }
  const source = fs.readFileSync(bridgePath, 'utf8');
  const calls = [...source.matchAll(/exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (calls.length !== 1) violations.push(`[R2] exposeInMainWorld 应恰好 1 次，实测 ${calls.length}`);
  if (calls[0] !== 'ossBrowser') violations.push(`[R2] 暴露键应为 ossBrowser，实测 ${calls[0]}`);
  if (/exposeInMainWorld\s*\([^)]*\b(ipcRenderer|shell|process|require)\b/.test(source)) {
    violations.push('[R2] 暴露参数含禁止对象（ipcRenderer/shell/process/require）');
  }
  if (/\bipcRenderer\s*\./.test(source)) {
    violations.push('[R2] net-bridge 直接调用 ipcRenderer（应下沉 capabilities/system.js）');
  }
  notes.push(`[R2] 暴露入口键：${calls.join(',') || '无'}`);
}

function ruleManifestImplementation(manifest, requireAll) {
  const capsDir = path.join(ROOT, 'app/preload/capabilities');
  if (!fs.existsSync(capsDir)) {
    const line = '[R3] app/preload/capabilities/ 尚未实现（P0-07~P0-12）';
    if (requireAll) violations.push(line);
    else notes.push(line + '，跳过实现集合比对');
    return;
  }
  const missing = [];
  for (const domain of Object.keys(manifest.domains || {})) {
    const entry = manifest.domains[domain];
    const expected = Object.keys(entry.methods || {}).filter((m) => entry.methods[m].expose !== false);
    if (expected.length === 0) continue;
    const file = path.join(capsDir, `${domain}.js`);
    if (!fs.existsSync(file)) {
      missing.push(domain);
      continue;
    }
    delete require.cache[require.resolve(file)];
    const impl = require(file);
    for (const method of expected) {
      if (typeof impl[method] !== 'function') {
        violations.push(`[R3] capabilities/${domain}.js 缺少已登记方法 ${method}`);
      }
    }
    for (const method of Object.keys(impl)) {
      if (typeof impl[method] === 'function' && expected.indexOf(method) < 0) {
        violations.push(`[R3] capabilities/${domain}.js 存在未登记方法 ${method}`);
      }
    }
  }
  if (missing.length > 0) {
    const line = `[R3] 未实现能力域 ${missing.length} 个：${missing.join('/')}`;
    if (requireAll) violations.push(line);
    else notes.push(line);
  }
}

const CONVENTION_CHANNEL_DOMAINS = ['oss', 'sts', 'ram', 'transfer', 'upgrade'];

function ruleChannelParity(manifest) {
  const mainSource = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const explicit = [...mainSource.matchAll(/ipcMain\.handle\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const declared = [...mainSource.matchAll(/['"]((?:oss|sts|ram|transfer|upgrade):[A-Za-z0-9_]+)['"]/g)].map((m) => m[1]);
  const handlers = new Set(explicit.concat(declared));
  const manifestChannels = new Set();
  for (const domain of Object.keys(manifest.domains || {})) {
    for (const method of Object.keys(manifest.domains[domain].methods || {})) {
      const meta = manifest.domains[domain].methods[method];
      if (meta.expose === false || meta.channel === false) continue;
      if (meta.channel) manifestChannels.add(meta.channel);
      else if (CONVENTION_CHANNEL_DOMAINS.indexOf(domain) >= 0) manifestChannels.add(domain + ':' + method);
    }
  }
  if (handlers.size === 0) violations.push('[R4] 未从 main.js 解析到任何 ipcMain.handle 通道');
  for (const channel of handlers) {
    if (!manifestChannels.has(channel)) violations.push(`[R4] 主进程通道 ${channel} 未在 manifest 登记`);
  }
  for (const channel of manifestChannels) {
    if (!handlers.has(channel)) violations.push(`[R4] manifest 通道 ${channel} 在主进程无 ipcMain.handle`);
  }
  notes.push(`[R4] 主进程通道 ${handlers.size} 个 / manifest 登记 ${manifestChannels.size} 个`);
}

const totals = ruleRendererNodeDirect();
const manifest = loadManifest();
const requireAll = process.argv.indexOf('--require-all') >= 0;
ruleExposureSurface();
ruleManifestImplementation(manifest, requireAll);
ruleChannelParity(manifest);

const exposed = Object.keys(manifest.domains || {}).reduce((acc, domain) => {
  const methods = manifest.domains[domain].methods || {};
  return acc + Object.keys(methods).filter((m) => methods[m].expose !== false).length;
}, 0);

console.log('verify-allowlist：渲染层 require/process/ipcRenderer 基线核对 + preload 暴露面 + manifest 实现 + 通道一致性');
for (const note of notes) console.log('  · ' + note);
console.log(`  · manifest 暴露方法 ${exposed} 个`);

if (violations.length > 0) {
  console.error(`\nFAIL：检出 ${violations.length} 项违规`);
  for (const item of violations) console.error('  ✗ ' + item);
  process.exit(1);
}

console.log('\nPASS：4 类检查均通过（R1 渲染层直连 / R2 暴露面 / R3 manifest 实现 / R4 通道一致性）');