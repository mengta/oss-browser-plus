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

describe('FilesPage：工具栏动作分发', () => {
  it('mkdir / delete / rename / restore / symlink / address / grant / grant-token 打开对应弹窗', async () => {
    const { wrapper } = await mountObjectPage();
    const ui = useUiStore();
    const open = vi.spyOn(ui, 'open').mockResolvedValue(undefined);
    const toolbar = wrapper.findComponent(FileToolbar);

    toolbar.vm.$emit('mkdir');
    expect(open).toHaveBeenLastCalledWith('add-folder', {
      currentInfo: { region: 'oss-cn-hangzhou', bucket: 'bucket-a', key: '' },
    });

    toolbar.vm.$emit('delete', [ITEM_FILE]);
    expect(open).toHaveBeenLastCalledWith('delete-files', {
      items: [ITEM_FILE],
      currentInfo: { region: 'oss-cn-hangzhou', bucket: 'bucket-a', key: '' },
    });

    toolbar.vm.$emit('rename', [ITEM_FILE]);
    expect(open.mock.calls.at(-1)[0]).toBe('rename');
    expect(open.mock.calls.at(-1)[1].item).toBe(ITEM_FILE);

    toolbar.vm.$emit('restore', [ITEM_ARCHIVE, ITEM_RESTORED]);
    expect(open).toHaveBeenLastCalledWith('batch-restore', {
      items: [ITEM_ARCHIVE],
      currentInfo: { region: 'oss-cn-hangzhou', bucket: 'bucket-a', key: '' },
    });

    toolbar.vm.$emit('symlink', [ITEM_FILE]);
    expect(open.mock.calls.at(-1)[0]).toBe('symlink');

    toolbar.vm.$emit('address', [ITEM_FILE]);
    expect(open.mock.calls.at(-1)[0]).toBe('get-address');

    toolbar.vm.$emit('grant', [ITEM_FILE]);
    expect(open.mock.calls.at(-1)[0]).toBe('grant');

    toolbar.vm.$emit('grant-token', [{ name: 'dir/', isFolder: true }]);
    expect(open.mock.calls.at(-1)[0]).toBe('grant-token');
  });

  it('空选择时 delete / copy / move / grant 不产生弹窗或暂存', async () => {
    const ui = useUiStore();
    const open = vi.spyOn(ui, 'open').mockResolvedValue(undefined);
    const { wrapper } = await mountObjectPage();
    const toolbar = wrapper.findComponent(FileToolbar);

    toolbar.vm.$emit('delete', []);
    toolbar.vm.$emit('copy', []);
    toolbar.vm.$emit('move', null);
    toolbar.vm.$emit('grant', []);
    toolbar.vm.$emit('rename', []);
    await nextTick();

    expect(open).not.toHaveBeenCalled();
    expect(toolbar.props('pastePending')).toBe(false);
  });

  it('restore 无可用对象时提示而不是开弹窗', async () => {
    const ui = useUiStore();
    const open = vi.spyOn(ui, 'open').mockResolvedValue(undefined);
    const push = vi.spyOn(useToastStore(), 'push');
    const { wrapper } = await mountObjectPage({ items: [ITEM_RESTORED] });

    wrapper.findComponent(FileToolbar).vm.$emit('restore', [ITEM_RESTORED]);
    await nextTick();

    expect(open).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalled();
  });

  it('只读账号：mkdir 被拦截，copy/move 仍可暂存但粘贴项禁用标记由菜单控制', async () => {
    const open = vi.spyOn(useUiStore(), 'open').mockResolvedValue(undefined);
    const { wrapper } = await mountObjectPage({ info: { privilege: 'readOnly' } });

    wrapper.findComponent(FileToolbar).vm.$emit('mkdir');
    await nextTick();

    expect(open).not.toHaveBeenCalled();
  });

  it('copy 暂存后 pastePending=true 且携带数量；cancel-paste 复位', async () => {
    const { wrapper } = await mountObjectPage({ items: [ITEM_FILE, ITEM_ARCHIVE] });
    const toolbar = wrapper.findComponent(FileToolbar);

    toolbar.vm.$emit('copy', [ITEM_FILE, ITEM_ARCHIVE]);
    await nextTick();
    expect(toolbar.props('pastePending')).toBe(true);
    expect(toolbar.props('pasteCount')).toBe(2);
    expect(toolbar.props('pasteIsCopy')).toBe(true);

    toolbar.vm.$emit('cancel-paste');
    await nextTick();
    expect(wrapper.findComponent(FileToolbar).props('pastePending')).toBe(false);
  });

  it('paste 跨桶：确认后打开 move 弹窗，取消则不开', async () => {
    const ui = useUiStore();
    const open = vi.spyOn(ui, 'open').mockResolvedValue(undefined);
    const confirm = vi.spyOn(ui, 'confirm').mockResolvedValue(false);
    const { wrapper } = await mountObjectPage();
    const toolbar = wrapper.findComponent(FileToolbar);

    toolbar.vm.$emit('copy', [ITEM_FILE]);
    await nextTick();
    const files = useFilesStore();
    files.bucket = 'bucket-b';
    await nextTick();
    toolbar.vm.$emit('paste');
    await flushPromises();
    expect(confirm).toHaveBeenCalled();

    confirm.mockResolvedValue(true);
    toolbar.vm.$emit('paste');
    await flushPromises();
    expect(open.mock.calls.some((call) => call[0] === 'move')).toBe(true);
  });

  it('paste 同桶单对象直接开 rename 弹窗', async () => {
    const ui = useUiStore();
    const open = vi.spyOn(ui, 'open').mockResolvedValue(Promise.resolve(undefined));
    const { wrapper } = await mountObjectPage();
    const toolbar = wrapper.findComponent(FileToolbar);

    toolbar.vm.$emit('move', [ITEM_FILE]);
    await nextTick();
    toolbar.vm.$emit('paste');
    await flushPromises();

    expect(open).toHaveBeenCalledWith(
      'rename',
      expect.objectContaining({ item: ITEM_FILE, isCopy: false })
    );
  });

  it('同目录移动提示不支持', async () => {
    // toast store spy 同样要在挂载前建立，确保命中页面持有的实例
    const push = vi.spyOn(useToastStore(), 'push');
    const { wrapper } = await mountObjectPage();

    const toolbar = wrapper.findComponent(FileToolbar);
    toolbar.vm.$emit('move', [ITEM_FILE, ITEM_ARCHIVE]);
    await nextTick();
    toolbar.vm.$emit('paste');
    await flushPromises();

    expect(push).toHaveBeenCalledWith(expect.any(String), 'warn', 3000);
  });

  it('未知工具栏动作不抛错', async () => {
    const { wrapper } = await mountObjectPage();

    expect(() => wrapper.findComponent(FileToolbar).vm.$emit('unknown-action')).not.toThrow();
    await nextTick();
  });
});

describe('FilesPage：对象右键菜单', () => {
  async function openFileMenu(wrapper, item = ITEM_FILE, index = 0) {
    wrapper.findComponent(FileList).vm.$emit('contextmenu', {
      event: { clientX: 20, clientY: 30 },
      item,
      index,
    });
    await nextTick();
    return wrapper.find('[data-testid="context-menu"]');
  }

  it('右键未选中行会自动选中该行', async () => {
    const { wrapper, files } = await mountObjectPage({ items: [ITEM_FILE, ITEM_ARCHIVE] });

    await openFileMenu(wrapper, ITEM_FILE, 0);

    expect(files.selectedMap['i_0']).toBe(true);
    expect(files.selectedList).toEqual([ITEM_FILE]);
    expect(files.selectedAll).toBe(false);
    expect(files.lastSelectedIndex).toBe(0);
  });

  it('已选中行右键不会重置选中集合', async () => {
    const { wrapper, files } = await mountObjectPage({ items: [ITEM_FILE, ITEM_ARCHIVE] });
    files.selectedMap = { i_1: true };
    files.selectedList = [ITEM_ARCHIVE];

    await openFileMenu(wrapper, ITEM_ARCHIVE, 1);

    expect(files.selectedMap).toEqual({ i_1: true });
    expect(files.selectedList).toEqual([ITEM_ARCHIVE]);
  });

  it('只读账号禁用写入类菜单项', async () => {
    const { wrapper } = await mountObjectPage({ info: { privilege: 'readOnly' } });
    await openFileMenu(wrapper);

    ['copy', 'move', 'rename', 'delete', 'acl'].forEach((key) => {
      expect(wrapper.find('[data-testid="ctx-' + key + '"]').attributes('disabled')).toBeDefined();
    });
    expect(wrapper.find('[data-testid="ctx-download"]').attributes('disabled')).toBeUndefined();
  });

  it('STS 账号禁用授权类菜单项', async () => {
    const { wrapper } = await mountObjectPage({ info: { id: 'STS.n1' } });
    await openFileMenu(wrapper, { name: 'dir/', isFolder: true });

    expect(wrapper.find('[data-testid="ctx-grant"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-grant-token"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-address"]').attributes('disabled')).toBeDefined();
  });

  it('目录对象禁用重命名以外的文件专属项', async () => {
    const { wrapper } = await mountObjectPage();
    const folder = { name: 'dir/', path: 'dir/', isFolder: true };
    await openFileMenu(wrapper, folder);

    expect(wrapper.find('[data-testid="ctx-rename"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="ctx-acl"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-grant-token"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="ctx-address"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-symlink"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-http-headers"]').attributes('disabled')).toBeDefined();
  });

  it('点击 copy 菜单项进入暂存态', async () => {
    const { wrapper } = await mountObjectPage();
    await openFileMenu(wrapper);

    await wrapper.find('[data-testid="ctx-copy"]').trigger('click');
    await nextTick();

    expect(wrapper.findComponent(FileToolbar).props('pastePending')).toBe(true);
  });

  it('点击 acl / http-headers 菜单项打开对应弹窗', async () => {
    const { wrapper } = await mountObjectPage();
    const ui = useUiStore();
    const open = vi.spyOn(ui, 'open').mockResolvedValue(undefined);

    await openFileMenu(wrapper);
    await wrapper.find('[data-testid="ctx-acl"]').trigger('click');
    expect(open).toHaveBeenLastCalledWith(
      'update-acl',
      expect.objectContaining({ item: ITEM_FILE })
    );

    await openFileMenu(wrapper);
    await wrapper.find('[data-testid="ctx-http-headers"]').trigger('click');
    expect(open).toHaveBeenLastCalledWith(
      'update-http-headers',
      expect.objectContaining({ item: [ITEM_FILE] })
    );
  });
});

describe('FilesPage：空白区右键菜单与调试入口', () => {
  it('空白区菜单包含上传/新建目录，并在有暂存时出现粘贴项', async () => {
    const { wrapper } = await mountObjectPage();
    wrapper.findComponent(FileToolbar).vm.$emit('copy', [ITEM_FILE]);
    await nextTick();

    wrapper.findComponent(FileList).vm.$emit('spacer-contextmenu', { clientX: 1, clientY: 1 });
    await nextTick();

    expect(wrapper.find('[data-testid="ctx-upload-files"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ctx-upload-folder"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ctx-mkdir"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ctx-paste"]').exists()).toBe(true);
  });

  it('点击上传项使用多选文件对话框', async () => {
    const showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: true, filePaths: [] } }));
    const { wrapper } = await mountObjectPage({ handlers: { showOpenDialog } });

    wrapper.findComponent(FileList).vm.$emit('spacer-contextmenu', { clientX: 1, clientY: 1 });
    await nextTick();
    await wrapper.find('[data-testid="ctx-upload-files"]').trigger('click');
    await flushPromises();

    expect(showOpenDialog).toHaveBeenCalledWith({
      title: 'Upload',
      properties: ['openFile', 'multiSelections'],
    });
  });

  it('点击新建目录打开弹窗', async () => {
    const { wrapper, openSpy: open } = await mountObjectPage();

    wrapper.findComponent(FileList).vm.$emit('spacer-contextmenu', { clientX: 1, clientY: 1 });
    await nextTick();
    await wrapper.find('[data-testid="ctx-mkdir"]').trigger('click');

    expect(open).toHaveBeenLastCalledWith('add-folder', expect.any(Object));
  });

  it('mock.uploads 输入经过 600ms 防抖后入队上传', async () => {
    const { wrapper } = await mountObjectPage();
    const transfer = useTransferStore();
    const createUploadJobs = vi.spyOn(transfer, 'createUploadJobs').mockResolvedValue([]);
    const push = vi.spyOn(useToastStore(), 'push');
    vi.useFakeTimers();

    const input = wrapper.find('[data-testid="mock-uploads"]');
    await input.setValue('C:/a.txt, C:/b.txt');
    await input.trigger('change');
    await nextTick();

    expect(createUploadJobs).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    await flushPromises();

    expect(createUploadJobs).toHaveBeenCalledWith(['C:/a.txt', 'C:/b.txt'], {
      region: 'oss-cn-hangzhou',
      bucket: 'bucket-a',
      key: '',
    });
    expect(push).toHaveBeenCalledWith(expect.any(String), 'info', 1000);
    expect(push).toHaveBeenCalledWith(expect.any(String), 'success', 2000);
    expect(transfer.visible).toBe(true);
    expect(transfer.activeTab).toBe('upload');
    vi.useRealTimers();
  });

  it('mock.uploads 空输入不触发上传', async () => {
    const { wrapper } = await mountObjectPage();
    const createUploadJobs = vi.spyOn(useTransferStore(), 'createUploadJobs').mockResolvedValue([]);
    vi.useFakeTimers();

    const input = wrapper.find('[data-testid="mock-uploads"]');
    await input.setValue('   ');
    await input.trigger('change');
    await vi.advanceTimersByTimeAsync(600);

    expect(createUploadJobs).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

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

    expect(createDownloadJobs).toHaveBeenCalledTimes(1);
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

    wrapper.findComponent(FileToolbar).vm.$emit('upload', false);
    await flushPromises();

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

    wrapper.findComponent(FileToolbar).vm.$emit('upload', true);
    await flushPromises();

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
