// R-03：体积核算（dist 与三平台 zip 字节数 + 目录分解 + 110% 判定）
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BASELINE_DIST_MB = 43; // B1~B2 基线
const LIMIT_DIST_MB = 46.2;

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
  } catch (e) {
    return 0;
  }
}

const distBytes = dirSize(DIST);
const breakdown = {};
for (const name of fs.readdirSync(DIST)) {
  const p = path.join(DIST, name);
  breakdown[name] = fs.statSync(p).isDirectory() ? dirSize(p) : fs.statSync(p).size;
}

const releasesDir = path.join(ROOT, 'releases');
const zips = [];
if (fs.existsSync(releasesDir)) {
  for (const d of fs.readdirSync(releasesDir).sort()) {
    const dir = path.join(releasesDir, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const v of fs.readdirSync(dir)) {
      const vdir = path.join(dir, v);
      if (!fs.statSync(vdir).isDirectory()) continue;
      for (const f of fs.readdirSync(vdir)) {
        if (f.endsWith('.zip')) zips.push({ file: path.join(v, f), bytes: fileSize(path.join(vdir, f)) });
      }
    }
  }
}

const result = {
  distBytes,
  distMB: Math.round((distBytes / 1024 / 1024) * 10) / 10,
  limitDistMB: LIMIT_DIST_MB,
  baselineDistMB: BASELINE_DIST_MB,
  distPass: distBytes / 1024 / 1024 <= LIMIT_DIST_MB,
  breakdown: Object.keys(breakdown)
    .sort((a, b) => breakdown[b] - breakdown[a])
    .map((k) => ({ name: k, bytes: breakdown[k] })),
  zips,
  zipNote: zips.length ? 'zip 产物见上（110% 判定以基线包对比）' : '本机无 1.21.0 zip（R-11 打包/CI 后复核）',
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
