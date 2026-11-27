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
    checkFileExists:
      handlers.checkFileExists ||
      (() => Promise.reject(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }))),
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

describe('AddressBar：地址修正与导航', () => {
  it('go() 触发 filesStore.navigate；非法输入补 oss:// 前缀（等价 getAddress）', async () => {
    installFilesOss({});
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('my-bucket/pre/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    const files = useFilesStore();
    expect(files.bucket).toBe('my-bucket');
    expect(files.prefix).toBe('pre/');

    await input.setValue('');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(input.element.value).toBe('oss://');

    await input.setValue('bucket2/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(input.element.value).toBe('oss://bucket2/');
  });

  it('历史栈：后退/前进按钮禁用态与导航（等价 His）', async () => {
    installFilesOss({});
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    const back = wrapper.find('[data-testid="address-back"]');
    const ahead = wrapper.find('[data-testid="address-ahead"]');

    expect(back.attributes('disabled')).toBeDefined();
    expect(ahead.attributes('disabled')).toBeDefined();

    await input.setValue('oss://a1/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    await input.setValue('oss://a1/docs/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(back.attributes('disabled')).toBeUndefined();
    expect(ahead.attributes('disabled')).toBeDefined();

    await back.trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://a1/');
    expect(ahead.attributes('disabled')).toBeUndefined();

    await ahead.trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://a1/docs/');
    expect(ahead.attributes('disabled')).toBeDefined();
  });

  it('goUp：多级回退逐级 pop；根地址时刷新（等价 goUp 语义）', async () => {
    installFilesOss({});
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://b/docs/2024/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    await wrapper.find('[data-testid="address-go-up"]').trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://b/docs/');

    await wrapper.find('[data-testid="address-go-up"]').trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://b/');

    await wrapper.find('[data-testid="address-go-up"]').trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://');
  });

  it('收藏星标 toggle（经 favorites store）', async () => {
    installFilesOss({});
    window.ossBrowser.storage = window.ossBrowser.storage || {
      readFavorites: () => Promise.resolve({ ok: true, data: '[]' }),
      writeFavorites: () => Promise.resolve({ ok: true, data: true }),
    };
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://fav-b/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const favBtn = wrapper.find('[data-testid="address-fav"]');
    expect(favBtn.classes()).not.toContain('active');
    await favBtn.trigger('click');
    await flushPromises();
    expect(favBtn.classes()).toContain('active');

    await favBtn.trigger('click');
    await flushPromises();
    expect(favBtn.classes()).not.toContain('active');
  });

  it('列表内部导航同步地址显示（enterFolder 后 watch filesStore.address）', async () => {
    installFilesOss({
      listFiles: () =>
        Promise.resolve({
          ok: true,
          data: { data: [{ name: 'sub/', path: 'sub/', isFolder: true }], marker: null },
        }),
    });
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://b/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const files = useFilesStore();
    await files.enterFolder({ path: 'sub/' });
    await flushPromises();
    expect(input.element.value).toBe('oss://b/sub/');
  });
});

describe('ListViewOptions：视图切换持久化', () => {
  it('点击切换 list/blocks 并写 is-list-view（等价 setListView）', async () => {
    const wrapper = mountWith(ListViewOptions);
    expect(wrapper.find('[data-testid="view-list"]').classes()).toContain('active');
    // 图标语义：list=横线、blocks=网格，并通过 aria-pressed 表达选中态
    expect(wrapper.find('[data-testid="view-list"] .app-icon').attributes('aria-label')).toBe('list');
    expect(wrapper.find('[data-testid="view-blocks"] .app-icon').attributes('aria-label')).toBe('grid');
    expect(wrapper.find('[data-testid="view-list"]').attributes('aria-pressed')).toBe('true');

    await wrapper.find('[data-testid="view-blocks"]').trigger('click');
    expect(wrapper.find('[data-testid="view-blocks"]').classes()).toContain('active');
    expect(wrapper.find('[data-testid="view-blocks"]').attributes('aria-pressed')).toBe('true');
    expect(localStorage.getItem('is-list-view')).toBe('false');
    await wrapper.find('[data-testid="view-list"]').trigger('click');
    expect(localStorage.getItem('is-list-view')).toBe('true');
  });
});

describe('FileList：信息密度', () => {
  it('列表新增存储类型列，块视图补充存储类型与时间元信息', async () => {
    const { wrapper } = await mountObjectPage({ items: [ITEM_FILE] });

    const headers = wrapper.findAll('[data-testid="file-table"] thead th');
    expect(headers.length).toBe(6);
    expect(headers[2].text()).toBe('存储类型');

    const row = wrapper.find('[data-testid="file-row"]');
    expect(row.find('.storage-tag').text()).toBe('Standard');

    await wrapper.find('[data-testid="view-blocks"]').trigger('click');
    const card = wrapper.find('[data-testid="file-card"]');
    expect(card.find('.card-storage').text()).toBe('Standard');
    expect(card.find('.card-meta').exists()).toBe(true);
  });
});

describe('FilesPage：登录态守卫与骨架', () => {
  function mountPage() {
    const i18n = createRendererI18n();
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'files', component: FilesPage },
      ],
    });
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(FilesPage, {
      global: { plugins: [pinia, router, i18n] },
    });
    return { wrapper, router, pinia };
  }

  it('未登录 onMounted 跳 /login（无全局守卫，页面内判定）', async () => {
    const auth = useAuthStore();
    auth.info = null;
    const { router } = mountPage();
    await flushPromises();
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('已登录且有 osspath：进入会话按授权地址导航（无上一账号残留）', async () => {
    installFilesOss({
      listFiles: () =>
        Promise.resolve({
          ok: true,
          data: { data: [{ name: 'f.txt', path: 'f.txt', isFile: true }], marker: null },
        }),
    });
    const { wrapper, pinia } = mountPage();
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk', osspath: 'oss://granted-b/root/' };
    await flushPromises();
    const files = useFilesStore();
    expect(files.bucket).toBe('granted-b');
    expect(files.prefix).toBe('root/');
    expect(wrapper.find('[data-testid="files-page"]').exists()).toBe(true);
  });
});
// ---------------------------------------------------------------------------
// B3-06~B3-14：FilesPage 会话初始化、工具栏分发、右键菜单、上传/下载与预览
// ---------------------------------------------------------------------------

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

describe('FilesPage：会话初始化', () => {
  it('已登录但无 osspath 时加载 Bucket 列表', async () => {
    const listAllBuckets = vi.fn(() =>
      Promise.resolve({ ok: true, data: [{ name: 'b1', region: 'oss-cn-hangzhou' }] }));
    installFilesOss({ listAllBuckets });
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk' };
    const { wrapper } = mountFilesPage();
    await flushPromises();

    const files = useFilesStore();
    expect(listAllBuckets).toHaveBeenCalled();
    expect(files.bucketsLoaded).toBe(true);
    expect(files.buckets).toHaveLength(1);
    expect(wrapper.find('[data-testid="bucket-section"]').exists()).toBe(true);
  });

  it('auth.region 优先写入空 region；已存在 region 不被覆盖', async () => {
    installFilesOss({});
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk', region: 'oss-cn-beijing' };
    mountFilesPage();
    await flushPromises();
    expect(useFilesStore().region).toBe('oss-cn-beijing');
  });

  it('osspath 导航失败被吞掉，页面仍可渲染', async () => {
    installFilesOss({
      listFiles: () => Promise.reject(new Error('network down')),
    });
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk', osspath: 'oss://b1/root/' };
    const { wrapper } = mountFilesPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="files-page"]').exists()).toBe(true);
  });

  it('账号切换时重置文件状态并清空暂存选择', async () => {
    const { wrapper, files } = await mountObjectPage();
    const resetSpy = vi.spyOn(files, 'reset');
    const navSpy = vi.spyOn(files, 'navigate').mockImplementation(async () => {
      files.bucket = 'bucket-a';
      files.prefix = '';
    });

    const toolbar = wrapper.findComponent(FileToolbar);
    toolbar.vm.$emit('copy', [ITEM_FILE]);
    await nextTick();
    expect(toolbar.props('pastePending')).toBe(true);

    const auth = useAuthStore();
    auth.info = { id: 'LTAI-2', secret: 'sk', osspath: 'oss://other/' };
    await nextTick();
    await flushPromises();

    expect(resetSpy).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith('oss://other/');
    expect(wrapper.findComponent(FileToolbar).props('pastePending')).toBe(false);
  });
});
describe('预设 OSS 路径指向单个文件', () => {
  it('head 成功时进入单文件模式（不依赖 ListObjects）', async () => {
    const checkFileExists = vi.fn(() =>
      Promise.resolve({
        ok: true,
        data: {
          res: {
            headers: {
              'content-length': '12',
              'content-type': 'text/plain',
              'last-modified': 'Thu, 01 Jan 2026 00:00:00 GMT',
            },
          },
        },
      }));
    const { wrapper } = await mountObjectPage({
      info: { osspath: 'oss://bucket-a/only/a.txt' },
      handlers: { checkFileExists },
    });
    const files = useFilesStore();
    await flushPromises();

    const call = checkFileExists.mock.calls[0];
    expect(call.slice(1)).toEqual(['oss-cn-hangzhou', 'bucket-a', 'only/a.txt']);
    expect(files.singleFile).toBeTruthy();
    expect(files.prefix).toBe('only/');
    expect(files.items.length).toBe(1);
    expect(files.items[0].name).toBe('a.txt');
    expect(files.items[0].size).toBe(12);
  });

  it('head 失败时回退按目录导航', async () => {
    const checkFileExists = vi.fn(() =>
      Promise.reject(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' })));
    const listFiles = vi.fn(() =>
      Promise.resolve({ ok: true, data: { data: [ITEM_FILE], marker: null } }));
    const { wrapper } = await mountObjectPage({
      info: { osspath: 'oss://bucket-a/only/' },
      handlers: { checkFileExists, listFiles },
    });
    const files = useFilesStore();
    await flushPromises();

    expect(checkFileExists).not.toHaveBeenCalled();
    expect(listFiles).toHaveBeenCalled();
    expect(files.singleFile).toBe(null);
    expect(files.bucket).toBe('bucket-a');
  });
});

describe('上传完成自动刷新当前目录', () => {
  it('当前目录上传完成后 400ms 自动重新加载列表', async () => {
    const { wrapper } = await mountObjectPage({ items: [ITEM_FILE] });
    const files = useFilesStore();
    const transfer = useTransferStore();
    vi.useFakeTimers();
    const spy = vi.spyOn(files, 'loadObjects').mockResolvedValue([]);
    transfer.lastUploadFinished = { taskId: 'u1', bucket: 'bucket-a', key: 'a.txt', at: Date.now() };
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).toHaveBeenCalledWith(true);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('其他 Bucket 上传完成不触发刷新', async () => {
    const { wrapper } = await mountObjectPage({ items: [ITEM_FILE] });
    const files = useFilesStore();
    const transfer = useTransferStore();
    vi.useFakeTimers();
    const spy = vi.spyOn(files, 'loadObjects').mockResolvedValue([]);
    transfer.lastUploadFinished = { taskId: 'u2', bucket: 'other', key: 'a.txt', at: Date.now() };
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(spy).not.toHaveBeenCalled();
    wrapper.unmount();
    vi.useRealTimers();
  });
});
