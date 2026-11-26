// 换肤预览截图（Chromium 真实渲染，不依赖 Electron 凭证）
// 用法：node tools/screenshot-vscode.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import vuePlugin from './esbuild-vue-plugin.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TMP = path.join(ROOT, '.codeartsdoer', 'temp', 'vscode-shots');
const OUT = path.join(ROOT, '.codeartsdoer', 'temp', 'screenshots');

const toPosix = (p) => p.replace(/\\/g, '/');

const LOCALES = {
  'zh-CN': {
    label: '简体中文',
    content: {
      'app.name': 'OSS浏览器',
      files: '文件',
      users: '子用户',
      bookmarks: '书签',
      settings: '设置',
      about: '关于',
      logout: '退出',
      'logout.message': '确定退出登录吗？',
      name: '名称',
      type: '类型',
      size: '大小',
      lastModifyTime: '最后修改时间',
      actions: '操作',
      folder: '目录',
      nodata: '暂无数据',
      'loading.more': '加载中...',
      upload: '上传',
      download: '下载',
      copy: '复制',
      move: '移动',
      rename: '重命名',
      delete: '删除',
      paste: '粘贴',
      'folder.create': '新建目录',
      'folder.name': '目录名',
      'select.all': '全选',
      'file.search.placeholder': '搜索文件',
      'search.files.placeholder': '搜索文件',
      acl: 'ACL',
      'simplePolicy': '简化 Policy',
      'getAddress': '获取地址',
      'http.headers': 'HTTP 头',
      restore: '恢复',
      'file.op.set_symlink': '设置软链接',
      more: '更多',
      region: '区域',
      'bucket.name': 'Bucket 名称',
      'bucket.search.placeholder': 'Bucket名称',
      'bucket.add': '新建 Bucket',
      refresh: '刷新',
      close: '关闭',
      ok: '确定',
      cancel: '取消',
      loading: '加载中',
      'auth.login': '登录',
      'login.id': 'AccessKeyId',
      'login.secret': 'AccessKeySecret',
    },
  },
  'en-US': { label: 'English', content: { 'app.name': 'OSS Browser', files: 'Files', settings: 'Settings' } },
  'ja-JP': { label: '日本語', content: { 'app.name': 'OSS Browser', files: 'ファイル' } },
};

const ITEMS = [
  { name: 'albums', path: 'photos/albums/', isFolder: true, lastModified: '2026-11-20T09:12:00Z' },
  { name: 'cover.jpg', path: 'photos/cover.jpg', isFile: true, size: 2457600, lastModified: '2026-11-25T18:40:12Z', storageClass: 'Standard' },
  { name: 'release-notes.pdf', path: 'photos/release-notes.pdf', isFile: true, size: 884736, lastModified: '2026-11-24T11:03:00Z', storageClass: 'Standard' },
  { name: 'design-spec.md', path: 'photos/design-spec.md', isFile: true, size: 12800, lastModified: '2026-11-25T09:00:00Z', storageClass: 'Standard' },
  { name: 'launch.flv', path: 'photos/launch.flv', isFile: true, size: 52428800, lastModified: '2026-11-19T22:10:00Z', storageClass: 'Standard' },
  { name: 'archive-2025.zip', path: 'photos/archive-2025.zip', isFile: true, size: 104857600, lastModified: '2026-11-18T08:00:00Z', storageClass: 'Archive' },
  { name: 'tmp', path: 'photos/tmp/', isFolder: true, lastModified: '2026-11-17T07:30:00Z' },
  { name: 'theme-dark.json', path: 'photos/theme-dark.json', isFile: true, size: 2048, lastModified: '2026-11-16T16:26:00Z', storageClass: 'Standard' },
];

function entrySource(mode) {
  return `import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import TopBar from '${toPosix(path.join(ROOT, 'app/renderer/components/business/TopBar.vue'))}';
import ActivityBar from '${toPosix(path.join(ROOT, 'app/renderer/components/business/ActivityBar.vue'))}';
import StatusBar from '${toPosix(path.join(ROOT, 'app/renderer/components/base/StatusBar.vue'))}';
import FilesPage from '${toPosix(path.join(ROOT, 'app/renderer/pages/FilesPage.vue'))}';
import LoginPage from '${toPosix(path.join(ROOT, 'app/renderer/pages/LoginPage.vue'))}';
import AboutModal from '${toPosix(path.join(ROOT, 'app/renderer/components/business/modals/AboutModal.vue'))}';
import { createRendererI18n } from '${toPosix(path.join(ROOT, 'app/renderer/i18n/index.js'))}';
import { useAuthStore } from '${toPosix(path.join(ROOT, 'app/renderer/stores/auth.js'))}';
import { useFilesStore } from '${toPosix(path.join(ROOT, 'app/renderer/stores/files.js'))}';

const mode = ${JSON.stringify(mode)};
const pinia = createPinia();
setActivePinia(pinia);
const auth = useAuthStore(pinia);
const files = useFilesStore(pinia);
const items = ${JSON.stringify(ITEMS)};

function seed() {
  if (mode === 'files') {
    auth.info = { id: 'LTAI5tQ2demoKey9', secret: 'sk-demo', desc: 'demo account' };
    files.buckets = [
      { name: 'demo-bucket', region: 'oss-cn-hangzhou', creationDate: '2026-01-01' },
      { name: 'assets-prod', region: 'oss-cn-hangzhou', creationDate: '2026-02-01' },
    ];
    files.bucket = 'demo-bucket';
    files.prefix = 'photos/';
    files.region = 'oss-cn-hangzhou';
    files.items = items.map((x) => Object.assign({}, x));
    files.selectedMap = { 'i_1': true, 'i_3': true };
    files.selectedList = [files.items[1], files.items[3]];
    files.selectedAll = false;
    files.isLoading = false;
  } else {
    auth.info = {};
    files.bucket = '';
    files.items = [];
    files.isLoading = false;
  }
}

seed();
setTimeout(seed, 500);
setTimeout(seed, 1200);

const i18n = createRendererI18n('zh-CN');
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'files', component: FilesPage },
    { path: '/login', name: 'login', component: LoginPage },
  ],
});
if (mode === 'login') router.replace('/login');

const Root = {
  render() {
    return h('div', { class: 'vue-app-shell' }, [
      h(TopBar),
      mode === 'files' ? h(ActivityBar) : null,
      h('main', { class: mode === 'files' ? 'vue-app-main with-activity' : 'vue-app-main' }, [mode === 'files' ? h(FilesPage) : mode === 'about' ? h(AboutModal) : h(LoginPage)]),
      h(StatusBar),
    ]);
  },
};
const app = createApp(Root);
app.use(pinia);
app.use(router);
app.use(i18n);
router.isReady().then(() => app.mount('#app'));
`;
}

function setupSource() {
  return `window.ossBrowser = {
  bootstrap: { get: () => ({ ok: true, data: { platform: 'win32', appVersion: '1.21.0', appTitle: 'OSS Browser', logo: ${JSON.stringify('file:///' + toPosix(path.join(ROOT, 'dist/icons/icon.png')))}, locales: ${JSON.stringify(LOCALES)} } }) },
  oss: {
    listAllBuckets: () => Promise.resolve({ ok: true, data: [] }),
    listFiles: () => Promise.resolve({ ok: true, data: { data: [], marker: null } }),
    listAllFiles: () => Promise.resolve({ ok: true, data: [] }),
    getFileInfo: () => Promise.resolve({ ok: true, data: {} }),
  },
  system: { getStaticServerPort: () => Promise.resolve({ ok: true, data: 7123 }), clipboardWriteText: () => Promise.resolve({ ok: true }) },
  storage: { readProgress: () => Promise.resolve({ ok: true, data: { exists: false, content: '' } }), listProgress: () => Promise.resolve({ ok: true, data: [] }) },
  credentials: { isAvailable: () => ({ ok: true, data: true }) },
  digest: { sha256Hex: () => ({ ok: true, data: '0'.repeat(64) }) },
  transfer: { subscribe: () => 's1', unsubscribe: () => {} },
  upgrade: {}, ram: {}, sts: {}, mail: {},
};
`;
}

async function shot(page, mode, file, waitSel) {
  await page.goto('file://' + toPosix(path.join(TMP, 'index.html')) + '?mode=' + mode);
  await page.waitForSelector(waitSel, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(TMP, 'setup.js'), setupSource(), 'utf8');
  const cssLib = 'file:///' + toPosix(path.join(ROOT, 'dist/css/lib.css'));
  const cssApp = 'file:///' + toPosix(path.join(ROOT, 'dist/app.css'));
  fs.writeFileSync(path.join(TMP, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="' + cssLib + '"><link rel="stylesheet" href="' + cssApp + '"><style>html,body{margin:0}</style></head><body><div id="app"></div><script src="setup.js"></script><script src="app.js"></script></body></html>', 'utf8');

  const files = ['files', 'login', 'about'];
  for (const mode of files) {
    fs.writeFileSync(path.join(TMP, 'entry-' + mode + '.js'), entrySource(mode), 'utf8');
    await esbuild.build({
      entryPoints: [path.join(TMP, 'entry-' + mode + '.js')],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: 'chrome120',
      outfile: path.join(TMP, 'app.js'),
      plugins: [vuePlugin()],
      loader: { '.svg': 'text', '.css': 'css' },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      logLevel: 'silent',
    });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await shot(page, mode, 'vscode-' + mode + '-v2.png', mode === 'files' ? '[data-testid="file-row"]' : mode === 'about' ? '[data-testid="about-modal"]' : '[data-testid="login-id"]');
    if (mode === 'login') {
      await page.hover('[data-testid="login-eptpl-help"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, 'vscode-login-tooltip.png'), fullPage: false });
      await page.fill('[data-testid="login-osspath"]', 'oss://demo/');
      await page.waitForTimeout(300);
      await page.hover('[data-testid="login-requestpay-help"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, 'vscode-login-requestpay-tooltip.png'), fullPage: false });
      const rpVisible = await page.isVisible('[data-testid="login-requestpay"]');
      process.stdout.write('requestpay visible=' + rpVisible + String.fromCharCode(10));
      await page.screenshot({ path: path.join(OUT, 'vscode-login-requestpay.png'), fullPage: false });
      if (rpVisible) {
        await page.click('[data-testid="login-requestpay"] input');
        await page.waitForTimeout(200);
        const checked = await page.isChecked('[data-testid="login-requestpay"] input');
        const stored = await page.evaluate(() => localStorage.getItem('show-request-pay'));
        process.stdout.write('requestpay checked=' + checked + ' stored=' + stored + String.fromCharCode(10));
      }
    }
    if (mode === 'files') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'vscode-files-light.png'), fullPage: false });
      const lightStyles = await page.evaluate(() => {
        const bg = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null; };
        const fg = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : null; };
        return { body: bg('body'), topbar: bg('.navbar'), button: bg('.btn-default'), buttonFg: fg('.btn-default'), input: bg('input[type="text"]'), tableHeader: bg('.table thead th'), statusbar: bg('[data-testid="status-bar"]') };
      });
      process.stdout.write('light styles: ' + JSON.stringify(lightStyles) + String.fromCharCode(10));
    }
    const styles = await page.evaluate(() => {
      const bg = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).backgroundColor : null;
      };
      const fg = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).color : null;
      };
      return {
        body: bg('body'),
        topbar: bg('.navbar'),
        statusbar: bg('[data-testid="status-bar"]'),
        button: bg('.btn-default'),
        buttonFg: fg('.btn-default'),
        input: bg('input[type="text"]'),
        inputFg: fg('input[type="text"]'),
        tableHeader: bg('.table thead th'),
      };
    });
    process.stdout.write(mode + ' styles: ' + JSON.stringify(styles) + String.fromCharCode(10));
    await browser.close();
  }
  process.stdout.write('screenshots: ' + OUT + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});