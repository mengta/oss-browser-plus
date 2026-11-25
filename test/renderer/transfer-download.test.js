import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import { useTransferStore } from '@renderer/stores/transfer.js';
import { useSettingsStore } from '@renderer/stores/settings.js';
import { useUiStore } from '@renderer/stores/ui.js';
import DownloadsPanel from '@renderer/components/business/transfer/DownloadsPanel.vue';
import FilesPage from '@renderer/pages/FilesPage.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';

// B3-07：下载链路契约（单/批量/目录递归/本地目录创建/并发/持久化/面板/页面接线）

const AUTH = { id: 'LTAI5tDown', secret: 'sk', eptpl: 'https://{region}.aliyuncs.com' };

let transferCalls = [];
let progressCb = null;

function installAll(overrides) {
  transferCalls = [];
  progressCb = null;
  const t = Object.assign(
    {
      subscribe(cb) {
        progressCb = cb;
        return 'sub-1';
      },
      unsubscribe() {},
      ensureDirs(paths) {
        transferCalls.push(['ensureDirs', paths]);
        return Promise.resolve({ ok: true, data: paths });
      },
      createDownload(auth, options) {
        transferCalls.push(['createDownload', auth, options]);
        return Promise.resolve({ ok: true, data: { taskId: 'down-' + transferCalls.length } });
      },
      pause(id) {
        transferCalls.push(['pause', id]);
        if (progressCb) progressCb({ taskId: id, status: 'stopped', prog: { loaded: 0, total: 0 } });
        return Promise.resolve({ ok: true, data: true });
      },
      resume(id) {
        transferCalls.push(['resume', id]);
        if (progressCb) progressCb({ taskId: id, status: 'running', prog: { loaded: 0, total: 0 } });
        return Promise.resolve({ ok: true, data: true });
      },
      clear(id) {
        transferCalls.push(['clear', id]);
        return Promise.resolve({ ok: true, data: true });
      },
      retry(id) {
        return Promise.resolve({ ok: true, data: { taskId: 'down-retry' } });
      },
      errorDetail() {
        return Promise.resolve({ ok: true, data: {} });
      },
      scanFolder() {
        return Promise.resolve({ ok: true, data: [] });
      },
    },
    overrides || {}
  );
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.transfer = t;
  window.ossBrowser.storage = window.ossBrowser.storage || {
    readProgress: () => Promise.resolve({ ok: true, data: { exists: false, content: '' } }),
    writeProgress: () => Promise.resolve({ ok: true, data: true }),
  };
}

function installOss(listFilesImpl) {
  window.ossBrowser.oss = {
    listFiles:
      listFilesImpl ||
      (() => Promise.resolve({ ok: true, data: { data: [], marker: null } })),
    listAllBuckets: () => Promise.resolve({ ok: true, data: [] }),
  };
}

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.transfer;
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

async function seedStore() {
  installAll({});
  installOss();
  const auth = useAuthStore();
  auth.info = AUTH;
  const store = useTransferStore();
  store.subscribe();
  return store;
}

describe('transfer store：下载入队', () => {
  it('单文件：relative 基准为首项父目录（a/b/f.txt → to/f.txt），createDownload from/to', async () => {
    const store = await seedStore();
    useSettingsStore().maxDownloadJobCount = 1;
    await store.createDownloadJobs(
      [{ region: 'oss-cn-hangzhou', bucket: 'demo-b', path: 'a/b/f.txt', name: 'f.txt', size: 100, isFolder: false }],
      'C:/local',
      { region: 'oss-cn-hangzhou', bucket: 'demo-b' }
    );

    const down = transferCalls.find((c) => c[0] === 'createDownload');
    expect(down).toBeTruthy();
    expect(down[2].from).toEqual({ bucket: 'demo-b', key: 'a/b/f.txt' });
    expect(down[2].to.path).toMatch(/C:[\\/]local[\\/]f\.txt$/);
    expect(down[2].to.name).toBe('f.txt');
    expect(down[1].accessKeyId).toBe(AUTH.id);

    expect(store.downloads.length).toBe(1);
    expect(store.downloads[0].type).toBe('download');
    expect(transferCalls.filter((c) => c[0] === 'resume').length).toBe(1);
  });

  it('目录递归：ensureDirs 建本地目录 + 子目录/子文件入队（层级保留）+ 分页续拉', async () => {
    const store = await seedStore();
    const pages = {
      'a/b/': [
        { data: [{ path: 'a/b/sub/', name: 'sub', isFolder: true }], marker: 'tok-2' },
        { data: [{ path: 'a/b/c.txt', name: 'c.txt', isFile: true, size: 10 }], marker: null },
      ],
      'a/b/sub/': [{ data: [{ path: 'a/b/sub/d.txt', name: 'd.txt', isFile: true, size: 20 }], marker: null }],
    };
    const callsByPrefix = {};
    installOss((authPayload, region, bucket, prefix, marker) => {
      console.log('LISTFILES-ARG:', JSON.stringify([region, bucket, prefix, marker]));
      const key = prefix + '|' + (marker || '');
      callsByPrefix[key] = true;
      const page = marker === 'tok-2' ? 1 : 0;
      const arr = pages[prefix] || [{ data: [], marker: null }];
      const res = arr[Math.min(page, arr.length - 1)];
      return Promise.resolve({ ok: true, data: { data: res.data, marker: res.marker } });
    });

    await store.createDownloadJobs(
      [{ region: 'oss-cn-hangzhou', bucket: 'demo-b', path: 'a/b/', name: 'b', size: 0, isFolder: true }],
      'C:/local',
      { region: 'oss-cn-hangzhou', bucket: 'demo-b' }
    );

    const ensure = transferCalls.filter((c) => c[0] === 'ensureDirs');
    expect(ensure.length).toBeGreaterThanOrEqual(2);
    expect(ensure[0][1][0]).toMatch(/C:[\\/]local[\\/]b$/);
    expect(ensure.some((c) => /sub$/.test(c[1][0]))).toBe(true);

    const downs = transferCalls.filter((c) => c[0] === 'createDownload');
    expect(downs.length).toBe(2);
    // 顺序无关（目录递归先于第二页文件，符合原版串行语义）
    const paths = downs.map((c) => c[2].to.path);
    expect(paths.some((p) => /b[\\/]c\.txt$/.test(p))).toBe(true);
    expect(paths.some((p) => /b[\\/]sub[\\/]d\.txt$/.test(p))).toBe(true);

    expect(callsByPrefix['a/b/|']).toBe(true);
    expect(callsByPrefix['a/b/|tok-2']).toBe(true);
    expect(store.downloads.length).toBe(2);
  });

  it('并发上限 maxDownloadJobCount=1：第二个 waiting 不立即 resume', async () => {
    const store = await seedStore();
    useSettingsStore().maxDownloadJobCount = 1;
    await store.createDownloadJobs(
      [
        { path: 'a/x.txt', name: 'x.txt', isFile: true, size: 1 },
        { path: 'a/y.txt', name: 'y.txt', isFile: true, size: 1 },
      ],
      'C:/local',
      { region: 'r', bucket: 'b' }
    );
    expect(store.downloads.length).toBe(2);
    expect(transferCalls.filter((c) => c[0] === 'resume').length).toBe(1);
    expect(store.downloadConcurrency).toBe(1);
  });
});

describe('transfer store：下载持久化与打开文件夹', () => {
  it('saveDownloadProgress：downprog_ 脱敏命名 + 1s 防抖', async () => {
    const store = await seedStore();
    const { createHash } = await import('node:crypto');
    window.ossBrowser.digest = {
      sha256Hex: (s) => ({ ok: true, data: createHash('sha256').update(String(s || '')).digest('hex') }),
    };
    const writes = [];
    window.ossBrowser.storage.writeProgress = (name, content) => {
      writes.push({ name, content });
      return Promise.resolve({ ok: true, data: true });
    };
    await store.createDownloadJobs([{ path: 'a/f.txt', name: 'f.txt', isFile: true, size: 5 }], 'C:/local', {
      region: 'r',
      bucket: 'b',
    });

    vi.useFakeTimers();
    store.saveDownloadProgress();
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
    await flushPromises();
    expect(writes.length).toBe(1);
    expect(/^downprog_.+\.json$/.test(writes[0].name)).toBe(true);
    expect(writes[0].name.indexOf('LTAI5tDown')).toBe(-1);
    const list = JSON.parse(writes[0].content);
    expect(list.length).toBe(1);
    expect(list[0].to.path).toMatch(/f\.txt$/);
  });

  it('loadDownloadProgress：恢复任务携带 checkPoints 且立即暂停', async () => {
    const store = await seedStore();
    const content = JSON.stringify([
      {
        region: 'r',
        from: { bucket: 'b', key: 'a/big.bin' },
        to: { name: 'big.bin', path: 'C:/local/big.bin' },
        checkPoints: { done: 1 },
        prog: { loaded: 5, total: 10 },
        status: 'waiting',
      },
    ]);
    window.ossBrowser.storage.readProgress = (name) =>
      /^downprog_/.test(String(name))
        ? Promise.resolve({ ok: true, data: { exists: true, content } })
        : Promise.resolve({ ok: true, data: { exists: false, content: '' } });
    transferCalls = [];
    await store.loadDownloadProgress();
    expect(store.downloads.length).toBe(1);
    const down = transferCalls.find((c) => c[0] === 'createDownload');
    expect(down[2].checkPoints).toEqual({ done: 1 });
    expect(store.downloads[0].status).toBe('stopped');
    expect(transferCalls.some((c) => c[0] === 'pause')).toBe(true);
  });

  it('openFolder：showItemInFolder 调用且去掉 .download 后缀', async () => {
    const store = await seedStore();
    await store.createDownloadJobs([{ path: 'a/f.txt', name: 'f.txt', isFile: true, size: 5 }], 'C:/local', {
      region: 'r',
      bucket: 'b',
    });
    const items = [];
    window.ossBrowser.system = {
      showItemInFolder: (p) => {
        items.push(p);
        return Promise.resolve({ ok: true, data: true });
      },
    };
    const task = store.downloads[0];
    task.to.path = 'C:/local/f.txt.download';
    const ok = await store.openFolder(task.taskId);
    expect(ok).toBe(true);
    expect(items[0]).toBe('C:/local/f.txt');
  });
});

describe('DownloadsPanel：行渲染与操作', () => {
  it('行渲染 to.name/百分比；打开文件夹按钮在位；清空全部确认后清空', async () => {
    const store = await seedStore();
    await store.createDownloadJobs(
      [
        { path: 'a/f.txt', name: 'f.txt', isFile: true, size: 10 },
        { path: 'a/g.txt', name: 'g.txt', isFile: true, size: 20 },
      ],
      'C:/local',
      { region: 'r', bucket: 'b' }
    );
    store.downloads[0].prog = { loaded: 5, total: 10 };
    store.downloads[0].status = 'running';
    store.downloads[0].speed = 100;
    const wrapper = mountWith(DownloadsPanel);
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="download-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].text()).toContain('f.txt');
    expect(rows[0].text()).toContain('50%');
    expect(rows[0].find('[data-testid="download-row-open-folder"]').exists()).toBe(true);

    await wrapper.find('[data-testid="downloads-filter-failed"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="download-row"]').length).toBe(0);

    store.searchText = '';
    const ui = useUiStore();
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(true);
    await wrapper.find('[data-testid="downloads-clear-all"]').trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalled();
    expect(store.downloads.length).toBe(0);
  });
});

describe('FilesPage：下载接线', () => {
  it('toolbar 下载事件 → showOpenDialog(openDirectory) → createDownloadJobs', async () => {
    installAll({});
    installOss();
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.info = AUTH;

    const dialogs = [];
    window.ossBrowser.system = {
      showOpenDialog: (opts) => {
        dialogs.push(opts);
        return Promise.resolve({ ok: true, data: { canceled: false, filePaths: ['C:/downloads/'] } });
      },
    };

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'files', component: FilesPage },
      ],
    });
    const files = useFilesStore();
    files.region = 'oss-cn-hangzhou';
    files.bucket = 'demo-b';
    files.prefix = '';
    files.items = [{ path: 'f.txt', name: 'f.txt', isFile: true, size: 9 }];
    files.selectedList = [files.items[0]];

    const transfer = useTransferStore();
    const createSpy = vi.spyOn(transfer, 'createDownloadJobs').mockResolvedValue([]);

    const wrapper = mount(FilesPage, { global: { plugins: [pinia, router, createRendererI18n()] } });
    await flushPromises();
    await wrapper.find('[data-testid="file-download"]').trigger('click');
    await flushPromises();

    expect(dialogs.length).toBe(1);
    expect(dialogs[0].properties).toEqual(['openDirectory']);
    expect(createSpy).toHaveBeenCalledTimes(1);
    const args = createSpy.mock.calls[0];
    expect(args[0]).toEqual([files.items[0]]);
    expect(args[1]).toBe('C:/downloads');
    expect(args[2]).toEqual({ region: 'oss-cn-hangzhou', bucket: 'demo-b', key: '' });
  });
});