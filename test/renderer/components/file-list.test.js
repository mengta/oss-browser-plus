import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import FileList from '@renderer/components/business/files/FileList.vue';
import FileToolbar from '@renderer/components/business/files/FileToolbar.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useUiStore } from '@renderer/stores/ui.js';

// B3-05：对象列表（列表/块视图、选中、操作列条件、空态）与工具栏（搜索防抖、条件禁用、计数）

const ITEMS = [
  { name: 'docs/', path: 'docs/', isFolder: true, itemType: 'folder' },
  {
    name: 'report.txt',
    path: 'report.txt',
    isFile: true,
    size: 2048,
    lastModified: '2024-01-02T03:04:05.000Z',
    storageClass: 'Standard',
  },
  {
    name: 'cold.zip',
    path: 'cold.zip',
    isFile: true,
    size: 1024,
    lastModified: '2024-01-03T03:04:05.000Z',
    storageClass: 'Archive',
  },
  {
    name: 'restoring.bin',
    path: 'restoring.bin',
    isFile: true,
    size: 512,
    storageClass: 'Archive',
    storageStatus: 2,
  },
];

function installOss(handlers) {
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = {
    listFiles: handlers.listFiles || (() => Promise.resolve({ ok: true, data: { data: ITEMS, marker: null } })),
    listAllBuckets: handlers.listAllBuckets || (() => Promise.resolve({ ok: true, data: [] })),
  };
}

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

async function seeded() {
  installOss({});
  const store = useFilesStore();
  store.region = 'oss-cn-hangzhou';
  await store.navigate('oss://demo-b/');
  return store;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

describe('FileList：列表视图', () => {
  it('目录置顶渲染（folder 文案 + folder 图标）；文件显示 size 与时间', async () => {
    await seeded();
    const wrapper = mountWith(FileList);
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="file-row"]');
    expect(rows.length).toBe(4);
    expect(rows[0].text()).toContain('docs/');
    expect(rows[0].text()).toContain('folder');
    expect(rows[1].text()).toContain('report.txt');
    expect(rows[1].text()).toContain('2');
  });

  it('Archive 未解冻灰显、恢复中 hourglass 警示（fileIcon filter 等价）', async () => {
    await seeded();
    const wrapper = mountWith(FileList);
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="file-row"]');
    // cold.zip：storageStatus 未定义（!=3）→ text-muted
    expect(rows[2].find('.name-cell svg').classes()).toContain('text-muted');
    // restoring.bin：storageStatus==2 → hourglass + text-warning
    expect(rows[3].find('.name-cell svg').classes()).toContain('text-warning');
  });

  it('操作列条件：address 仅文件且未 Archive 未解冻；restore 仅 Archive 未解冻；目录有下载', async () => {
    await seeded();
    const wrapper = mountWith(FileList);
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="file-row"]');
    // docs/（目录）：无 address，有 download
    expect(rows[0].find('[data-testid="file-row-address"]').exists()).toBe(false);
    expect(rows[0].find('[data-testid="file-row-download"]').exists()).toBe(true);
    // report.txt：address + download
    expect(rows[1].find('[data-testid="file-row-address"]').exists()).toBe(true);
    // cold.zip：Archive 未解冻 → 无 download，有 restore
    expect(rows[2].find('[data-testid="file-row-download"]').exists()).toBe(false);
    expect(rows[2].find('[data-testid="file-row-restore"]').exists()).toBe(true);
    // restoring.bin：storageStatus==2（未到 3）→ restore 显示
    expect(rows[3].find('[data-testid="file-row-restore"]').exists()).toBe(true);
  });

  it('点击行内复选框可正常选中（click 不冒泡二次切换）', async () => {
    const store = await seeded();
    const wrapper = mountWith(FileList);
    await flushPromises();
    const checkbox = wrapper.findAll('[data-testid="file-row"]')[1].find('input[type="checkbox"]');

    const spy = vi.spyOn(store, 'selectChanged');
    await checkbox.trigger('click');
    // @click.stop：复选框的 click 不应冒泡触发行选中（修复前会二次切换导致无法选中）
    expect(spy).not.toHaveBeenCalled();

    checkbox.element.checked = true;
    await checkbox.trigger('change');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.selectedMap['i_1']).toBe(true);
  });

  it('单击选中 shift 区间；名称链接进入目录 / 打开文件 emit', async () => {
    const store = await seeded();
    const wrapper = mountWith(FileList);
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="file-row"]');

    await rows[1].trigger('click');
    expect(store.selectedList.length).toBe(1);
    await rows[2].trigger('click', { shiftKey: true });
    await flushPromises();
    expect(store.selectedList.length).toBe(2);
    expect(rows[1].classes()).toContain('info');

    await rows[0].find('[data-testid="file-folder-link"]').trigger('click');
    await flushPromises();
    expect(store.prefix).toBe('docs/');

    await rows[1].find('[data-testid="file-open-link"]').trigger('click');
    expect(wrapper.emitted('preview')).toBeTruthy();
    expect(wrapper.emitted('preview')[0][0].name).toBe('report.txt');
  });

  it('空列表显示 nodata（不渲染表格）', async () => {
    installOss({ listFiles: () => Promise.resolve({ ok: true, data: { data: [], marker: null } }) });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://demo-b/');
    const wrapper = mountWith(FileList);
    await flushPromises();
    expect(wrapper.find('[data-testid="file-table"]').exists()).toBe(false);
    expect(wrapper.text().length).toBeGreaterThan(0);
  });
});

describe('FileList：块视图', () => {
  it('卡片渲染名称 + 描述（folder/size），双击目录进入、双击文件 emit preview', async () => {
    const store = await seeded();
    store.setView('blocks');
    const wrapper = mountWith(FileList);
    await flushPromises();
    const cards = wrapper.findAll('[data-testid="file-card"]');
    expect(cards.length).toBe(4);
    expect(cards[0].text()).toContain('docs/');
    expect(cards[0].text()).toContain('folder');
    expect(cards[1].text()).toContain('report.txt');

    await cards[0].trigger('dblclick');
    await flushPromises();
    expect(store.prefix).toBe('docs/');
  });
});

describe('FileToolbar：搜索/条件/计数', () => {
  it('搜索 600ms 防抖后调用 store.search（服务端 prefix）', async () => {
    const store = await seeded();
    const searchSpy = vi.spyOn(store, 'search').mockResolvedValue([]);
    vi.useFakeTimers();
    const wrapper = mountWith(FileToolbar);
    await flushPromises();

    await wrapper.find('[data-testid="file-search"]').setValue('2024-');
    await wrapper.find('[data-testid="file-search"]').trigger('input');
    expect(searchSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(searchSpy).toHaveBeenCalledWith('2024-');
    vi.useRealTimers();
  });

  it('选中条件驱动按钮禁用：无选中 → 下载/复制/更多禁用；单选文件 → ACL/地址/软链可用', async () => {
    const store = await seeded();
    const wrapper = mountWith(FileToolbar);
    await flushPromises();
    expect(wrapper.find('[data-testid="file-download"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="file-copy"]').attributes('disabled')).toBeDefined();

    store.selectedList = [ITEMS[1]];
    await flushPromises();
    expect(wrapper.find('[data-testid="file-download"]').attributes('disabled')).toBeUndefined();

    await wrapper.find('[data-testid="file-more"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="more-acl"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="more-address"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="more-symlink"]').attributes('disabled')).toBeUndefined();
  });

  it('ACL/HTTP 头直连 B2-09 弹窗（ui.open 参数含 currentInfo）', async () => {
    const store = await seeded();
    const ui = useUiStore();
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);
    const wrapper = mountWith(FileToolbar);
    await flushPromises();

    store.selectedList = [ITEMS[1]];
    await flushPromises();
    await wrapper.find('[data-testid="file-more"] button').trigger('click');
    await wrapper.find('[data-testid="more-acl"]').trigger('click');
    await flushPromises();
    expect(openSpy).toHaveBeenCalledWith('update-acl', {
      item: ITEMS[1],
      currentInfo: { region: 'oss-cn-hangzhou', bucket: 'demo-b' },
    });
  });

  it('计数显示 hasMore 时追加 "+"；STS 账号隐藏区域显示', async () => {
    const store = await seeded();
    store.marker = 'tok';
    const wrapper = mountWith(FileToolbar);
    await flushPromises();
    expect(wrapper.find('[data-testid="file-count"]').text()).toBe('4+');

    const auth = useAuthStore();
    auth.info = { id: 'STS.abc', secret: 'sk' };
    await flushPromises();
    expect(wrapper.find('[data-testid="file-region"]').exists()).toBe(false);
  });

  it('只读账号禁用上传/新建目录/复制/删除（readOnly 约束）', async () => {
    await seeded();
    const auth = useAuthStore();
    auth.info = { id: 'LTAI5t', secret: 'sk', privilege: 'readOnly' };
    const store = useFilesStore();
    store.selectedList = [ITEMS[1]];
    const wrapper = mountWith(FileToolbar);
    await flushPromises();
    expect(wrapper.find('[data-testid="file-upload"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="file-mkdir"]').attributes('disabled')).toBeDefined();
    await wrapper.find('[data-testid="file-more"] button').trigger('click');
    expect(wrapper.find('[data-testid="more-delete"]').attributes('disabled')).toBeDefined();
  });
});