import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import ContextMenu from '@renderer/components/base/ContextMenu.vue';
import FileList from '@renderer/components/business/files/FileList.vue';
import BucketList from '@renderer/components/business/files/BucketList.vue';
import FilesPage from '@renderer/pages/FilesPage.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';

// B3-14：自研右键菜单契约

const ITEMS = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B', disabled: true },
  { key: 'c', label: 'C' },
];

let calls = [];

function installOss(overrides) {
  calls = [];
  const oss = Object.assign(
    {
      listAllBuckets: () => Promise.resolve({ ok: true, data: [] }),
      listFiles: () => Promise.resolve({ ok: true, data: { data: [], marker: null } }),
      deleteBucket: () => Promise.resolve({ ok: true, data: {} }),
    },
    overrides || {}
  );
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = oss;
}

function mountWith(component, props, options) {
  const pinia = (options && options.pinia) || getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('ContextMenu：项/选择/Esc/外部点击', () => {
  it('渲染项；点击可用项 emit select+close；disabled 项不触发', async () => {
    const wrapper = mountWith(ContextMenu, { visible: true, x: 10, y: 20, items: ITEMS });
    await flushPromises();
    expect(wrapper.findAll('.cm-item').length).toBe(3);

    await wrapper.find('[data-testid="ctx-b"]').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();

    await wrapper.find('[data-testid="ctx-a"]').trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['a']);
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('Esc 与外部 mousedown 关闭', async () => {
    const wrapper = mountWith(ContextMenu, { visible: true, x: 10, y: 20, items: ITEMS });
    await flushPromises();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const closeCount = wrapper.emitted('close').length;
    expect(closeCount).toBe(1);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(wrapper.emitted('close').length).toBe(closeCount + 1);

    wrapper.unmount();
  });
});

describe('FileList / BucketList：右键事件', () => {
  it('FileList 行右键 emit item/index；空白 emit spacer', async () => {
    const pinia = getActivePinia();
    const files = useFilesStore(pinia);
    files.items = [{ name: 'a.txt', path: 'pre/a.txt', isFile: true }];
    const wrapper = mountWith(FileList, {}, { pinia });
    await flushPromises();

    await wrapper.find('[data-testid="file-row"]').trigger('contextmenu');
    const payload = wrapper.emitted('contextmenu')[0][0];
    expect(payload.item.path).toBe('pre/a.txt');
    expect(payload.index).toBe(0);

    await wrapper.find('[data-testid="file-list"]').trigger('contextmenu');
    expect(wrapper.emitted('spacer-contextmenu')).toBeTruthy();
  });

  it('BucketList 行右键 emit item；空白 emit spacer', async () => {
    const pinia = getActivePinia();
    const files = useFilesStore(pinia);
    files.buckets = [{ name: 'b1', region: 'r1' }];
    const wrapper = mountWith(BucketList, {}, { pinia });
    await flushPromises();

    await wrapper.find('[data-testid="bucket-table"] tbody tr').trigger('contextmenu');
    expect(wrapper.emitted('contextmenu')[0][0].item.name).toBe('b1');

    await wrapper.find('[data-testid="bucket-list"]').trigger('contextmenu');
    expect(wrapper.emitted('spacer-contextmenu')).toBeTruthy();
  });
});

describe('FilesPage：菜单项条件与命令', () => {
  function mountPage(privilege) {
    installOss({});
    const pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore(pinia).info = { id: 'LTAI', secret: 'sk', privilege: privilege || 'all' };
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'files', component: FilesPage },
      ],
    });
    const wrapper = mount(FilesPage, {
      global: { plugins: [pinia, router, createRendererI18n()] },
    });
    const files = useFilesStore(pinia);
    files.bucket = 'b';
    files.prefix = 'pre/';
    files.region = 'r';
    return { wrapper, files, pinia };
  }

  it('右键行自动选中并显示菜单；重命名命令打开弹窗', async () => {
    const { wrapper, files, pinia } = mountPage();
    await flushPromises();
    files.items = [{ name: 'a.txt', path: 'pre/a.txt', isFile: true }];
    files.clearSelection();
    await flushPromises();

    const ui = useUiStore(pinia);
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);

    await wrapper.find('[data-testid="file-row"]').trigger('contextmenu', { clientX: 40, clientY: 50 });
    await flushPromises();
    expect(files.selectedList.length).toBe(1);
    expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ctx-download"]').exists()).toBe(true);

    await wrapper.find('[data-testid="ctx-rename"]').trigger('click');
    await flushPromises();
    expect(openSpy.mock.calls[0][0]).toBe('rename');
  });

  it('readOnly：复制/移动/删除禁用；空白菜单含上传与新建目录', async () => {
    const { wrapper, files } = mountPage('readOnly');
    await flushPromises();
    files.items = [{ name: 'a.txt', path: 'pre/a.txt', isFile: true }];
    await flushPromises();

    await wrapper.find('[data-testid="file-row"]').trigger('contextmenu');
    await flushPromises();
    expect(wrapper.find('[data-testid="ctx-copy"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-delete"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="file-list"]').trigger('contextmenu');
    await flushPromises();
    expect(wrapper.find('[data-testid="ctx-upload-files"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ctx-mkdir"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="ctx-paste"]').exists()).toBe(false);
  });

  it('Bucket 右键：ACL 命令打开属性弹窗；删除需确认', async () => {
    const { wrapper, files, pinia } = mountPage();
    await flushPromises();
    files.bucket = '';
    files.buckets = [{ name: 'b1', region: 'r1', creationDate: '' }];
    await flushPromises();

    const ui = useUiStore(pinia);
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(false);

    await wrapper.find('[data-testid="bucket-table"] tbody tr').trigger('contextmenu');
    await flushPromises();
    expect(wrapper.find('[data-testid="ctx-bucket-acl"]').exists()).toBe(true);

    await wrapper.find('[data-testid="ctx-bucket-acl"]').trigger('click');
    await flushPromises();
    expect(openSpy.mock.calls[0][0]).toBe('update-bucket');
    expect(openSpy.mock.calls[0][1].bucketInfo.name).toBe('b1');

    await wrapper.find('[data-testid="bucket-table"] tbody tr').trigger('contextmenu');
    await flushPromises();
    await wrapper.find('[data-testid="ctx-bucket-delete"]').trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalled();
    expect(calls.some((c) => c[0] === 'deleteBucket')).toBe(false);
  });
});