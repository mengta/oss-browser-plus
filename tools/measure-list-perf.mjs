// B3-16：1000 项列表性能测量（Chromium 真实渲染，近似 Electron 渲染进程同内核）
// 用法：node tools/measure-list-perf.mjs [--rows=1000] [--duration=10000]
// 输出 JSON：首屏渲染耗时、渲染行数、滚动平均帧率、DTO 序列化耗时与阈值判定。
// 说明：跨世界 IPC 传输耗时无法在纯浏览器测量，dtoSerializeMs 为 DTO 序列化/反序列化的近似成本，已在 ledger 登记。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import vuePlugin from './esbuild-vue-plugin.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TMP = path.join(ROOT, '.codeartsdoer', 'temp', 'perf');
const ROWS = Number((process.argv.find((a) => a.indexOf('--rows=') === 0) || '--rows=1000').split('=')[1]) || 1000;
const DURATION = Number((process.argv.find((a) => a.indexOf('--duration=') === 0) || '--duration=10000').split('=')[1]) || 10000;

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

const LOCALES = {
  'zh-CN': {
    label: '简体中文',
    content: {
      name: '名称',
      type: '类型',
      size: '大小',
      lastModifyTime: '最后修改时间',
      actions: '操作',
      folder: '目录',
      nodata: '暂无数据',
      'loading.more': '加载中...',
      download: '下载',
      delete: '删除',
      getAddress: '获取地址',
      restore: '恢复',
    },
  },
  'en-US': { label: 'English', content: { name: 'Name', size: 'Size', folder: 'Folder' } },
  'ja-JP': { label: '日本語', content: { name: '名前', size: 'サイズ', folder: 'フォルダ' } },
};

function entrySource() {
  return `import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import FileList from '${toPosix(path.join(ROOT, 'app/renderer/components/business/files/FileList.vue'))}';
import { createRendererI18n } from '${toPosix(path.join(ROOT, 'app/renderer/i18n/index.js'))}';
import { useFilesStore } from '${toPosix(path.join(ROOT, 'app/renderer/stores/files.js'))}';

const pinia = createPinia();
setActivePinia(pinia);
const files = useFilesStore(pinia);
files.bucket = 'perf-bucket';
files.prefix = '';
files.region = 'oss-cn-hangzhou';
const items = [];
for (let i = 0; i < ${ROWS}; i += 1) {
  items.push({
    name: 'obj-' + i + '.txt',
    path: 'obj-' + i + '.txt',
    isFile: true,
    size: 1024 + i,
    lastModified: '2026-01-01T00:00:00.000Z',
    storageClass: 'Standard',
  });
}
const dtoStart = performance.now();
const text = JSON.stringify(items);
JSON.parse(text);
const dtoSerializeMs = performance.now() - dtoStart;
files.items = items;
files.selectedAll = false;
files.selectedMap = {};
files.selectedList = [];
files.isLoading = false;

const app = createApp({ render: () => h('div', { id: 'wrap', style: 'height:600px;overflow:auto' }, [h(FileList)]) });
app.use(pinia).use(createRendererI18n());
const t0 = performance.now();
app.mount('#app');
requestAnimationFrame(() => requestAnimationFrame(() => {
  window.__perf = {
    firstPaintMs: performance.now() - t0,
    rowCount: document.querySelectorAll('[data-testid="file-row"]').length,
    dtoSerializeMs,
    ready: true,
  };
}));
`;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry.js');
  fs.writeFileSync(entry, entrySource(), 'utf8');
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome120',
    outfile: path.join(TMP, 'perf.js'),
    plugins: [vuePlugin()],
    loader: { '.svg': 'text', '.css': 'css' },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    logLevel: 'silent',
  });

  const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><div id="app"></div><script src="perf.js"></script></body></html>';
  const pagePath = path.join(TMP, 'index.html');
  fs.writeFileSync(pagePath, html, 'utf8');

  // 本机无 Playwright chromium 时回退到系统 Chromium 内核浏览器（Edge/Chrome，同内核）
  const fallbackBrowsers = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  const launchOptions = {};
  const fallback = fallbackBrowsers.find((p) => fs.existsSync(p));
  if (fallback) launchOptions.executablePath = fallback;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.addInitScript((locales) => {
    window.ossBrowser = {
      bootstrap: {
        get: () => ({
          ok: true,
          data: { platform: 'win32', appVersion: '1.21.0', locales },
        }),
      },
      oss: {},
      system: {},
      storage: {},
      credentials: {},
      digest: {},
      transfer: {},
      upgrade: {},
      ram: {},
      sts: {},
      mail: {},
    };
  }, LOCALES);

  await page.goto('file://' + toPosix(pagePath));
  await page.waitForFunction(() => window.__perf && window.__perf.ready === true, null, { timeout: 30000 });

  const perf = await page.evaluate(() => ({
    firstPaintMs: window.__perf.firstPaintMs,
    rowCount: window.__perf.rowCount,
    dtoSerializeMs: window.__perf.dtoSerializeMs,
  }));

  const fps = await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const wrap = document.getElementById('wrap');
        const start = performance.now();
        let frames = 0;
        const step = () => {
          frames += 1;
          const max = Math.max(1, wrap.scrollHeight - wrap.clientHeight);
          wrap.scrollTop = (wrap.scrollTop + 40) % max;
          if (performance.now() - start < duration) requestAnimationFrame(step);
          else resolve(frames / ((performance.now() - start) / 1000));
        };
        requestAnimationFrame(step);
      }),
    DURATION
  );

  await browser.close();

  const result = {
    rows: ROWS,
    rowCount: perf.rowCount,
    firstPaintMs: Math.round(perf.firstPaintMs),
    fps: Math.round(fps * 10) / 10,
    dtoSerializeMs: Math.round(perf.dtoSerializeMs * 100) / 100,
    thresholds: { firstPaintMs: 1500, fps: 50, rowCount: ROWS },
    pass: {
      firstPaint: perf.firstPaintMs <= 1500,
      fps: fps >= 50,
      rowsRendered: perf.rowCount === ROWS,
    },
  };
  result.pass.all = result.pass.firstPaint && result.pass.fps && result.pass.rowsRendered;

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (err) {
    /* 临时目录清理失败不阻断 */
  }

  if (!result.pass.all) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});