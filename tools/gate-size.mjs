// P1（R-P1-06 · 门禁 ⑪）：体积与产物完整性门禁。
//   node tools/gate-size.mjs --zip=<zip> [--prev=<baseline.zip>] [--dist=dist] [--asar=<app.asar>]
// 判定：dist ≤ 48,447,897 B；zip ≤ prev × 1.10（且 ≤ 161,533,060 B）；zip 可校验（testzip/结构）；
//      三核心齐备（exe / resources/custom/index.js / resources/app.asar）；可选 asar 顶层 ≥ 7 项。
// 退出码：0 通过；1 违规；2 参数/环境错误。环境缺失的 asar 校验打印 SKIP_ASAR，不静默计为通过但退出仍 0。

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const LIMIT_DIST_BYTES = 48447897;
const LIMIT_ZIP_BYTES = 161533060;
const MAX_RATIO = 1.1;

const ROOT = process.cwd();
const args = process.argv.slice(2);
const argOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};

const DIST = path.resolve(ROOT, argOf('dist') || 'dist');
const ZIP = argOf('zip') ? path.resolve(ROOT, argOf('zip')) : '';
const PREV = argOf('prev') ? path.resolve(ROOT, argOf('prev')) : '';
const ASAR = argOf('asar') ? path.resolve(ROOT, argOf('asar')) : '';

function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    total += st.isDirectory() ? dirSize(p) : st.size;
  }
  return total;
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function readZipEntries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  const minPos = Math.max(0, buf.length - 65558);
  for (let i = buf.length - 22; i >= minPos; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP_EOCD_NOT_FOUND');
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p < end && buf.readUInt32LE(p) === 0x02014b50) {
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    entries.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (entries.length !== total) throw new Error('ZIP_CENTRAL_DIR_MISMATCH');
  return entries;
}

function pythonTestzip(file) {
  for (const exe of ['python', 'python3', 'py']) {
    const res = spawnSync(
      exe,
      ['-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);bad=z.testzip();print("OK" if bad is None else "BAD:"+str(bad))', file],
      { encoding: 'utf8' }
    );
    if (res.error) continue;
    const out = (res.stdout || '').trim();
    if (res.status === 0 && out.startsWith('OK')) return { ok: true, via: exe };
    return { ok: false, via: exe, detail: out || (res.stderr || '').trim() };
  }
  return { ok: false, via: '', detail: 'python not available' };
}

function readAsarTopLevel(file) {
  const fd = fs.openSync(file, 'r');
  try {
    // Chromium Pickle：u32@0=4, u32@4=pickle 长度, u32@8=JSON 长度, JSON 自 offset 16 开始
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const jsonSize = head.readUInt32LE(8);
    const jsonBuf = Buffer.alloc(jsonSize);
    fs.readSync(fd, jsonBuf, 0, jsonSize, 16);
    let text = jsonBuf.toString('utf8').replace(/\0+$/, '');
    try {
      return Object.keys(JSON.parse(text).files || {});
    } catch {
      const end = text.lastIndexOf('}');
      text = text.slice(0, end + 1);
      return Object.keys(JSON.parse(text).files || {});
    }
  } finally {
    fs.closeSync(fd);
  }
}

const problems = [];
const distBytes = dirSize(DIST);
if (distBytes === 0) {
  console.error(`GATE_DIST_MISSING: ${DIST}`);
  process.exit(2);
}
if (distBytes > LIMIT_DIST_BYTES) {
  problems.push(`GATE_DIST_OVERSIZE: ${distBytes} > ${LIMIT_DIST_BYTES}`);
}

let zipBytes = 0;
let ratio = 0;
if (ZIP) {
  zipBytes = fileSize(ZIP);
  if (!zipBytes) {
    console.error(`GATE_ZIP_MISSING: ${ZIP}`);
    process.exit(2);
  }
  if (zipBytes > LIMIT_ZIP_BYTES) {
    problems.push(`GATE_ZIP_OVERSIZE: ${zipBytes} > ${LIMIT_ZIP_BYTES}`);
  }
  const prevBytes = PREV ? fileSize(PREV) : 0;
  if (prevBytes) {
    ratio = zipBytes / prevBytes;
    if (ratio > MAX_RATIO) {
      problems.push(`GATE_ZIP_RATIO: ${ratio.toFixed(4)} > ${MAX_RATIO} (prev=${prevBytes})`);
    }
  }

  let entries = [];
  try {
    entries = readZipEntries(ZIP);
  } catch (err) {
    problems.push(`GATE_ZIP_STRUCTURE: ${err.message}`);
  }

  if (entries.length) {
    const hasExecutable = entries.some((n) => {
      const p = n.replace(/\\/g, '/');
      return /(^|\/)oss-browser(\.exe)?$/i.test(p) || /(^|\/)oss-browser\.app\//i.test(p);
    });
    const hasCustom = entries.some((n) => n.replace(/\\/g, '/').endsWith('resources/custom/index.js'));
    const hasAsar = entries.some((n) => n.replace(/\\/g, '/').endsWith('resources/app.asar'));
    if (!hasExecutable) problems.push('GATE_CORE_MISSING: oss-browser');
    if (!hasCustom) problems.push('GATE_CORE_MISSING: resources/custom/index.js');
    if (!hasAsar) problems.push('GATE_CORE_MISSING: resources/app.asar');
  }

  const testzip = pythonTestzip(ZIP);
  if (!testzip.ok) {
    if (testzip.via) {
      problems.push(`GATE_ZIP_TESTZIP: ${testzip.detail || 'failed'}`);
    } else {
      console.log('WARN_ZIP_TESTZIP: python unavailable, structure check only');
    }
  }
}

if (ASAR) {
  if (!fs.existsSync(ASAR)) {
    console.log(`SKIP_ASAR: ${ASAR} not found (run electron-builder first)`);
  } else {
    try {
      const top = readAsarTopLevel(ASAR);
      if (top.length < 7) {
        problems.push(`GATE_ASAR_TOPLEVEL: ${top.length} < 7 (${top.join(',')})`);
      } else {
        console.log(`ASAR_TOPLEVEL(${top.length}): ${top.join(',')}`);
      }
    } catch (err) {
      problems.push(`GATE_ASAR_PARSE: ${err.message}`);
    }
  }
} else {
  console.log('SKIP_ASAR: no --asar=<path> provided');
}

console.log(
  JSON.stringify(
    {
      distBytes,
      limitDistBytes: LIMIT_DIST_BYTES,
      zipBytes,
      limitZipBytes: LIMIT_ZIP_BYTES,
      prevZipBytes: PREV ? fileSize(PREV) : null,
      zipRatio: ratio ? Number(ratio.toFixed(4)) : null,
    },
    null,
    2
  )
);

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`FAIL: ${problems.length} gate violation(s)`);
  process.exit(1);
}
console.log('PASS: size gate OK');