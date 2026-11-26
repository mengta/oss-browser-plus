// R-13/B4-13：启动耗时与内存峰值测量（Electron 真实启动，3 次取中位）
// 用法：node tools/measure-startup.mjs
import { _electron as electron } from 'playwright';
import path from 'path';

const ROOT = path.resolve('.');
const RUNS = 3;

async function once() {
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  const t0 = Date.now();
  const app = await electron.launch({ args: ['.'], cwd: ROOT, env });
  const page = await app.firstWindow();
  await page.waitForSelector('#app-ready', { timeout: 30000 });
  const startupMs = Date.now() - t0;
  let rss = null;
  try {
    const info = await app.evaluate(async ({ app: _app }) => process.getProcessMemoryInfo());
    rss = info && info.private ? Math.round(info.private / 1024) : null;
  } catch (e) {
    rss = null;
  }
  await app.close();
  return { startupMs, rssMB: rss };
}

async function main() {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    runs.push(await once());
  }
  const sorted = runs.map((r) => r.startupMs).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const result = {
    runs,
    startupMedianMs: median,
    startupRangeMs: [sorted[0], sorted[sorted.length - 1]],
    rssMaxMB: Math.max(...runs.map((r) => r.rssMB || 0)) || null,
    thresholds: { startupMs: 3000, startupVsBaselinePct: 120 },
    pass: { startup: median <= 3000 },
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
