import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import AddressBar from '@renderer/components/business/files/AddressBar.vue';
import ListViewOptions from '@renderer/components/business/files/ListViewOptions.vue';
import FilesPage from '@renderer/pages/FilesPage.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { nextTick } from 'vue';
import FileList from '@renderer/components/business/files/FileList.vue';
import FileToolbar from '@renderer/components/business/files/FileToolbar.vue';
import BucketList from '@renderer/components/business/files/BucketList.vue';
import DropZone from '@renderer/components/base/DropZone.vue';
import ContextMenu from '@renderer/components/base/ContextMenu.vue';
import { useTransferStore } from '@renderer/stores/transfer.js';
import { useToastStore } from '@renderer/stores/toast.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useBootstrapStore } from '@renderer/stores/bootstrap.js';

// B3-02：文件页骨架与地址栏三组件契约

function installFilesOss(handlers) {
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = {
    listAllBuckets: handlers.listAllBuckets || (() => Promise.resolve({ ok: true, data: [] })),
    listFiles: handlers.listFiles || (() => Promise.resolve({ ok: true, data: { data: [], marker: null } })),
  };
}

function mountWith(wrapperComponent) {
  const i18n = createRendererI18n();
  return mount(wrapperComponent, {
    global: { plugins: [createPinia(), i18n] },
  });
}

// 每个用例挂载的根组件在用例结束后卸载，避免实例与 store 订阅跨用例累积
const mountedWrappers = [];

afterEach(() => {
  while (mountedWrappers.length) {
    try {
      mountedWrappers.pop().unmount();
    } catch (err) {
      /* 已卸载 */
    }
  }
});

beforeEach(() => {
  localStorage.clear();
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
  setActivePinia(createPinia());
});

const ITEM_FILE = { name: 'a.txt', path: 'a.txt', isFile: true, size: 10, storageClass: 'Standard' };
const ITEM_ARCHIVE = { name: 'cold.zip', path: 'cold.zip', storageClass: 'Archive', storageStatus: 1 };
const ITEM_RESTORED = { name: 'warm.zip', path: 'warm.zip', storageClass: 'Archive', storageStatus: 3 };

function mountFilesPage() {
  const i18n = createRendererI18n();
  // 复用当前 active pinia：调用方可能已在其上设置 auth / files 状态
  const pinia = getActivePinia() || createPinia();
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div/>' } },
      { path: '/', name: 'files', component: FilesPage },
    ],
  });
  setActivePinia(pinia);
  const wrapper = mount(FilesPage, { global: { plugins: [pinia, router, i18n] } });
  mountedWrappers.push(wrapper);
  return { wrapper, router, pinia };
}

async function mountObjectPage({ info = {}, items = [ITEM_FILE], handlers = {} } = {}) {
  installFilesOss({
    listFiles: () => Promise.resolve({ ok: true, data: { data: items, marker: null } }),
    ...handlers,
  });
  window.ossBrowser.oss.deleteBucket =
    handlers.deleteBucket || (() => Promise.resolve({ ok: true, data: {} }));
  window.ossBrowser.system = {
    ...window.ossBrowser.system,
    showOpenDialog:
      handlers.showOpenDialog ||
      (() => Promise.resolve({ ok: true, data: { canceled: true, filePaths: [] } })),
  };
  // 关键：在 mount 前把 store 置为「已加载对象目录」状态。
  // FilesPage 的 initSession 只在 bucketsLoaded=false 时才会发起请求，
  // 这样首帧即是对象区，避免 navigate 期间列表被卸载导致 emit 命中失活实例。
  const pinia = getActivePinia() || createPinia();
  setActivePinia(pinia);
  const files = useFilesStore();
  files.bucketsLoaded = true;
  files.bucket = 'bucket-a';
  files.prefix = '';
  files.region = 'oss-cn-hangzhou';
  files.items = items;
  files.isLoading = false;

  const auth = useAuthStore();
  auth.info = { id: 'LTAI', secret: 'sk', region: 'oss-cn-hangzhou', ...info };

  // spy 必须在挂载前建立：组件 setup 内持有的是当前 pinia 的 store 实例
  const openSpy = vi.spyOn(useUiStore(), 'open').mockResolvedValue(undefined);
  const mounted = mountFilesPage();
  await flushPromises();

  // 等待 initSession 的 navigate 完成并渲染对象区：
  // 期间 AutoHeightBox 会因 loading 卸载/重挂列表，提前 emit 会命中已失活的组件实例
  await vi.waitFor(
    () => {
      const ready =
        mounted.wrapper.findComponent(FileList).exists() &&
        !files.isLoading &&
        files.bucket === 'bucket-a';
      if (!ready) throw new Error('files page not ready');
    },
    { timeout: 3000, interval: 20 }
  );
  return { ...mounted, files, openSpy };
}

describe('FilesPage：Bucket 右键菜单', () => {
  function mountBucketPage(handlers = {}, info = {}) {
    installFilesOss({
      listAllBuckets: () =>
        Promise.resolve({
          ok: true,
          data: [{ name: 'bucket-a', region: 'oss-cn-hangzhou', creationDate: '2024-01-01' }],
        }),
      ...handlers,
    });
    window.ossBrowser.oss.deleteBucket =
      handlers.deleteBucket || (() => Promise.resolve({ ok: true, data: {} }));
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk', ...info };
    return mountFilesPage();
  }

  it('Bucket 右键菜单展示四项能力', async () => {
    const { wrapper } = mountBucketPage();
    await flushPromises();
    const bucket = { name: 'bucket-a', region: 'oss-cn-hangzhou' };

    wrapper
      .findComponent(BucketList)
      .vm.$emit('contextmenu', { event: { clientX: 3, clientY: 4 }, item: bucket });
    await nextTick();

    ['bucket-multipart', 'bucket-acl', 'bucket-grant', 'bucket-delete'].forEach((key) => {
      expect(wrapper.find('[data-testid="ctx-' + key + '"]').exists()).toBe(true);
    });
  });

  it('删除 Bucket 需确认：取消不调用删除接口', async () => {
    const deleteBucket = vi.fn(() => Promise.resolve({ ok: true, data: {} }));
    const confirm = vi.spyOn(useUiStore(), 'confirm').mockResolvedValue(false);
    const { wrapper } = mountBucketPage({ deleteBucket });
    await flushPromises();

    wrapper

      .findComponent(BucketList)
      .vm.$emit('contextmenu', { event: {}, item: { name: 'bucket-a', region: 'oss-cn-hangzhou' } });
    await nextTick();
    // 经菜单 select 事件分发，规避渲染时序对点击命中的影响
    wrapper.findComponent(ContextMenu).vm.$emit('select', 'bucket-delete');
    await flushPromises();

    expect(confirm).toHaveBeenCalled();
    expect(deleteBucket).not.toHaveBeenCalled();
  });

  it('确认后删除 Bucket 并提示成功', async () => {
    const deleteBucket = vi.fn(() => Promise.resolve({ ok: true, data: {} }));
    vi.spyOn(useUiStore(), 'confirm').mockResolvedValue(true);
    const push = vi.spyOn(useToastStore(), 'push');
    const { wrapper } = mountBucketPage({ deleteBucket });
    await flushPromises();

    wrapper
      .findComponent(BucketList)
      .vm.$emit('contextmenu', { event: {}, item: { name: 'bucket-a', region: 'oss-cn-hangzhou' } });
    await nextTick();
    // 经菜单 select 事件分发，规避渲染时序对点击命中的影响
    wrapper.findComponent(ContextMenu).vm.$emit('select', 'bucket-delete');
    await flushPromises();

    expect(deleteBucket).toHaveBeenCalledWith(
      expect.any(Object),
      'oss-cn-hangzhou',
      'bucket-a'
    );
    expect(push).toHaveBeenCalledWith(expect.any(String), 'success', 2000);
  });

  it('删除 Bucket 失败提示错误信息', async () => {
    const deleteBucket = vi.fn(() => Promise.reject(new Error('BucketNotEmpty')));
    vi.spyOn(useUiStore(), 'confirm').mockResolvedValue(true);
    const push = vi.spyOn(useToastStore(), 'push');
    const { wrapper } = mountBucketPage({ deleteBucket });
    await flushPromises();

    wrapper
      .findComponent(BucketList)
      .vm.$emit('contextmenu', { event: {}, item: { name: 'bucket-a', region: 'oss-cn-hangzhou' } });
    await nextTick();
    // 经菜单 select 事件分发，规避渲染时序对点击命中的影响
    wrapper.findComponent(ContextMenu).vm.$emit('select', 'bucket-delete');
    await flushPromises();

    expect(push).toHaveBeenCalledWith('BucketNotEmpty', 'danger', 4000);
  });

  it('Bucket 空白区新建按钮受 STS 账号限制', async () => {
    const { wrapper } = mountBucketPage({}, { id: 'STS.n1' });
    await flushPromises();

    wrapper.findComponent(BucketList).vm.$emit('spacer-contextmenu', { clientX: 1, clientY: 1 });
    await nextTick();

    expect(wrapper.find('[data-testid="ctx-bucket-add"]').attributes('disabled')).toBeDefined();
  });
});

describe('FilesPage：预览分发与行内操作', () => {
  it.each([
    ['a.png', 'preview-picture'],
    ['a.mp4', 'preview-media'],
    ['a.mp3', 'preview-media'],
    ['a.pdf', 'preview-doc'],
    ['a.js', 'preview-code'],
    ['a.txt', 'preview-others'],
  ])('%s 打开 %s', async (name, modal) => {
    const { wrapper, openSpy: open } = await mountObjectPage();
    const item = { name, path: name, isFile: true };

    const list = wrapper.findComponent(FileList);
    expect(list.exists()).toBe(true);
    list.vm.$emit('preview', item);
    await nextTick();
    await flushPromises();

    expect(open).toHaveBeenCalledWith(
      modal,
      expect.objectContaining({ objectInfo: item, bucketInfo: expect.objectContaining({ bucket: 'bucket-a' }) })
    );
  });

  it('空对象预览不打开弹窗', async () => {
    const { wrapper, openSpy: open } = await mountObjectPage();

    wrapper.findComponent(FileList).vm.$emit('preview', null);
    await nextTick();
    await flushPromises();

    expect(open).not.toHaveBeenCalled();
  });

  it('行内 delete / restore / address 打开对应弹窗', async () => {
    const { wrapper, openSpy: open } = await mountObjectPage();
    const list = wrapper.findComponent(FileList);

    list.vm.$emit('action', { type: 'delete', item: ITEM_FILE });
    expect(open).toHaveBeenLastCalledWith(
      'delete-files',
      expect.objectContaining({ items: [ITEM_FILE] })
    );

    list.vm.$emit('action', { type: 'address', item: ITEM_FILE });
    expect(open).toHaveBeenLastCalledWith('get-address', expect.objectContaining({ item: ITEM_FILE }));

    list.vm.$emit('action', { type: 'unknown', item: ITEM_FILE });
    list.vm.$emit('action', null);
    await nextTick();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('行内 restore 打开解冻弹窗', async () => {
    const { wrapper, openSpy: open } = await mountObjectPage({ items: [ITEM_ARCHIVE] });

    wrapper.findComponent(FileList).vm.$emit('action', { type: 'restore', item: ITEM_ARCHIVE });
    await nextTick();

    expect(open).toHaveBeenLastCalledWith('restore', expect.objectContaining({ item: ITEM_ARCHIVE }));
  });

  it('行内 download 选择目录后创建下载任务', async () => {
    const showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: false, filePaths: ['C:/dl/'] } }));
    const { wrapper } = await mountObjectPage({ handlers: { showOpenDialog } });
    const transfer = useTransferStore();
    const createDownloadJobs = vi.spyOn(transfer, 'createDownloadJobs').mockResolvedValue([]);

    wrapper.findComponent(FileList).vm.$emit('action', { type: 'download', item: ITEM_FILE });
    await flushPromises();
    await vi.waitFor(() => expect(createDownloadJobs).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const [jobs, targetDir, info] = createDownloadJobs.mock.calls[0];
    expect(jobs).toEqual([ITEM_FILE]);
    expect(targetDir).toBe('C:/dl');
    expect(info).toMatchObject({ region: 'oss-cn-hangzhou', bucket: 'bucket-a' });
    expect(transfer.visible).toBe(true);
    expect(transfer.activeTab).toBe('download');
  });

  it('下载目录被取消时不创建任务', async () => {
    const showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: true, filePaths: [] } }));
    const { wrapper } = await mountObjectPage({ handlers: { showOpenDialog } });
    const createDownloadJobs = vi.spyOn(useTransferStore(), 'createDownloadJobs').mockResolvedValue([]);

    wrapper.findComponent(FileList).vm.$emit('action', { type: 'download', item: ITEM_FILE });
    await flushPromises();

    expect(createDownloadJobs).not.toHaveBeenCalled();
  });
});

describe('FilesPage：上传与下载链路', () => {
  it('上传文件：选择文件后创建任务、提示并刷新目录', async () => {
    const showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: false, filePaths: ['C:/up/a.txt'] } }));
    const { wrapper, files } = await mountObjectPage({ handlers: { showOpenDialog } });
    const transfer = useTransferStore();
    const createUploadJobs = vi.spyOn(transfer, 'createUploadJobs').mockResolvedValue([]);
    const loadObjects = vi.spyOn(files, 'loadObjects').mockResolvedValue(undefined);
    const push = vi.spyOn(useToastStore(), 'push');

    await wrapper.find('[data-testid="file-upload"]').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(createUploadJobs).toHaveBeenCalledTimes(1), { timeout: 5000 });

    expect(showOpenDialog).toHaveBeenCalledWith({
      title: 'Upload',
      properties: ['openFile', 'multiSelections'],
    });
    expect(createUploadJobs).toHaveBeenCalledWith(['C:/up/a.txt'], {
      region: 'oss-cn-hangzhou',
      bucket: 'bucket-a',
      key: '',
    });
    expect(push).toHaveBeenCalledWith(expect.any(String), 'info', 1000);
    expect(push).toHaveBeenCalledWith(expect.any(String), 'success', 2000);
    expect(transfer.visible).toBe(true);
    expect(transfer.activeTab).toBe('upload');
    expect(loadObjects).toHaveBeenCalledWith(true);
  });

  it('上传目录：使用 openDirectory 多选属性', async () => {
    const showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: true, filePaths: [] } }));
    const { wrapper } = await mountObjectPage({ handlers: { showOpenDialog } });

    await wrapper.find('[data-testid="file-upload-folder"]').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(showOpenDialog).toHaveBeenCalledTimes(1), { timeout: 5000 });

    expect(showOpenDialog).toHaveBeenCalledWith({
      title: 'Upload',
      properties: ['openDirectory', 'multiSelections'],
    });
  });

  it('取消选择文件时不上传', async () => {
    const createUploadJobs = vi.spyOn(useTransferStore(), 'createUploadJobs').mockResolvedValue([]);
    const { wrapper } = await mountObjectPage();

    wrapper.findComponent(FileToolbar).vm.$emit('upload', false);
    await flushPromises();

    expect(createUploadJobs).not.toHaveBeenCalled();
  });

  it('桥接缺少 showOpenDialog 时上传/下载入口静默返回', async () => {
    const { wrapper } = await mountObjectPage();
    window.ossBrowser.system = {};

    expect(() => wrapper.findComponent(FileToolbar).vm.$emit('upload', false)).not.toThrow();
    expect(() => wrapper.findComponent(FileToolbar).vm.$emit('download', [ITEM_FILE])).not.toThrow();
    await flushPromises();
  });

  it('拖拽空路径不创建上传任务', async () => {
    const { wrapper } = await mountObjectPage();
    const createUploadJobs = vi.spyOn(useTransferStore(), 'createUploadJobs').mockResolvedValue([]);
    const dropZone = wrapper.findComponent(DropZone);

    dropZone.vm.$emit('dropped', []);
    dropZone.vm.$emit('dropped', null);
    await flushPromises();

    expect(createUploadJobs).not.toHaveBeenCalled();
  });

  it('Bucket 空白区新建：确认后提示并刷新列表', async () => {
    installFilesOss({
      listAllBuckets: () => Promise.resolve({ ok: true, data: [] }),
    });
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk' };
    const open = vi.spyOn(useUiStore(), 'open').mockResolvedValue(true);
    const push = vi.spyOn(useToastStore(), 'push');
    const { wrapper } = mountFilesPage();
    await flushPromises();

    wrapper.findComponent(BucketList).vm.$emit('spacer-contextmenu', { clientX: 1, clientY: 1 });
    await nextTick();
    // 经菜单 select 事件分发（避免 disabled/渲染时序影响）
    wrapper.findComponent(ContextMenu).vm.$emit('select', 'bucket-add');
    await flushPromises();

    expect(open).toHaveBeenCalledWith('add-bucket');
    expect(push).toHaveBeenCalledWith(expect.any(String), 'success', 2000);
  });
});
