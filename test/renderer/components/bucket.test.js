import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import BucketToolbar from '@renderer/components/business/files/BucketToolbar.vue';
import BucketList from '@renderer/components/business/files/BucketList.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useUiStore } from '@renderer/stores/ui.js';

// B3-03：Bucket 工具栏与列表契约

const BUCKETS = [
  { name: 'archive-b', region: 'oss-cn-hangzhou', creationDate: '2024-01-02T03:04:05.000Z', storageClass: 'Archive' },
  { name: 'std-b', region: 'oss-cn-beijing', creationDate: '2024-02-03T04:05:06.000Z', storageClass: 'Standard' },
];

function installOss(handlers) {
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = {
    listAllBuckets: handlers.listAllBuckets || (() => Promise.resolve({ ok: true, data: BUCKETS })),
    listFiles: handlers.listFiles || (() => Promise.resolve({ ok: true, data: { data: [], marker: null } })),
    deleteBucket: handlers.deleteBucket || (() => Promise.resolve({ ok: true, data: {} })),
  };
}

function mountWith(component) {
  // 与 seedBuckets 共享同一 active pinia（避免双实例）
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

async function seedBuckets() {
  installOss({});
  const store = useFilesStore();
  await store.loadBuckets();
  return store;
}

describe('BucketList：列表/块视图与选中', () => {
  it('列表视图渲染表格行（名称/区域/创建时间/操作列）', async () => {
    await seedBuckets();
    const wrapper = mountWith(BucketList);
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="bucket-table"] tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].text()).toContain('archive-b');
    expect(rows[0].text()).toContain('oss-cn-hangzhou');
    expect(rows[0].find('[data-testid="bucket-row-delete"]').exists()).toBe(true);
    // Archive 图标着色规则（非 Archive → text-warning，等价原版 storageClass!='Archive'）
    expect(rows[0].find('.bucket-name').classes()).not.toContain('text-warning');
    expect(rows[1].find('.bucket-name').classes()).toContain('text-warning');
  });

  it('块视图渲染卡片（名称/区域），list-view=false 时生效', async () => {
    await seedBuckets();
    const store = useFilesStore();
    store.setView('blocks');
    const wrapper = mountWith(BucketList);
    await flushPromises();
    const cards = wrapper.findAll('[data-testid="bucket-cards"] .card');
    expect(cards.length).toBe(2);
    expect(cards[0].text()).toContain('archive-b');
    expect(cards[0].text()).toContain('oss-cn-hangzhou');
  });

  it('单击选中切换、双击进入 bucket（navigate oss://name/）', async () => {
    const store = await seedBuckets();
    const wrapper = mountWith(BucketList);
    await flushPromises();
    const firstRow = wrapper.findAll('tbody tr')[0];

    await firstRow.trigger('click');
    expect(store.bucketSelected && store.bucketSelected.name).toBe('archive-b');
    await firstRow.trigger('click');
    expect(store.bucketSelected).toBe(null);

    await firstRow.trigger('dblclick');
    await flushPromises();
    expect(store.bucket).toBe('archive-b');
  });

  it('空态渲染 nodata（过滤无命中时）', async () => {
    await seedBuckets();
    const store = useFilesStore();
    store.bucketFilter = 'zzz-no-match';
    const wrapper = mountWith(BucketList);
    await flushPromises();
    expect(wrapper.find('[data-testid="bucket-table"]').exists()).toBe(false);
    expect(wrapper.text().length).toBeGreaterThan(0);
  });

  it('行内删除经 ui.confirm 确认后调用 deleteBucket（取消无副作用）', async () => {
    const deleted = [];
    installOss({
      deleteBucket: (auth, region, name) => {
        deleted.push({ region, name });
        return Promise.resolve({ ok: true, data: {} });
      },
    });
    const store = useFilesStore();
    await store.loadBuckets();
    const ui = useUiStore();
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(false);
    const wrapper = mountWith(BucketList);
    await flushPromises();

    await wrapper.findAll('[data-testid="bucket-row-delete"]')[0].trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleted.length).toBe(0);

    confirmSpy.mockResolvedValue(true);
    await wrapper.findAll('[data-testid="bucket-row-delete"]')[0].trigger('click');
    await flushPromises();
    expect(deleted.length).toBe(1);
    expect(deleted[0]).toEqual({ region: 'oss-cn-hangzhou', name: 'archive-b' });
  });
});

describe('BucketToolbar：入口与搜索', () => {
  it('未选中时碎片/ACL/Policy/删除按钮禁用；选中后启用', async () => {
    const store = await seedBuckets();
    const wrapper = mountWith(BucketToolbar);
    await flushPromises();
    for (const id of ['bucket-multipart', 'bucket-acl', 'bucket-grant', 'bucket-more-delete']) {
      expect(wrapper.find('[data-testid="' + id + '"]').attributes('disabled')).toBeDefined();
    }
    store.bucketSelected = BUCKETS[0];
    await flushPromises();
    for (const id of ['bucket-multipart', 'bucket-acl', 'bucket-grant', 'bucket-more-delete']) {
      expect(wrapper.find('[data-testid="' + id + '"]').attributes('disabled')).toBeUndefined();
    }
  });

  it('STS 账号禁用新建 Bucket（等价 currentAuthInfo.id 前缀判定）', async () => {
    await seedBuckets();
    const auth = useAuthStore();
    auth.info = { id: 'STS.abc', secret: 'sk' };
    const wrapper = mountWith(BucketToolbar);
    await flushPromises();
    expect(wrapper.find('[data-testid="bucket-add"]').attributes('disabled')).toBeDefined();

    auth.info = { id: 'LTAI5t', secret: 'sk' };
    await flushPromises();
    expect(wrapper.find('[data-testid="bucket-add"]').attributes('disabled')).toBeUndefined();
  });

  it('搜索框客户端过滤（等价 buckets|filter:sch.bucketName）+ 计数', async () => {
    const store = await seedBuckets();
    const wrapper = mountWith(BucketToolbar);
    await flushPromises();
    expect(wrapper.find('[data-testid="bucket-count"]').text()).toBe('2');

    await wrapper.find('[data-testid="bucket-search"]').setValue('std');
    expect(store.bucketFilter).toBe('std');
    expect(store.filteredBuckets.length).toBe(1);
    expect(store.filteredBuckets[0].name).toBe('std-b');
    expect(wrapper.find('[data-testid="bucket-count"]').text()).toBe('1');
  });

  it('新建 Bucket 入口经 uiStore.open(add-bucket)，成功后刷新列表', async () => {
    installOss({});
    const store = useFilesStore();
    await store.loadBuckets();
    const auth = useAuthStore();
    auth.info = { id: 'LTAI5t', secret: 'sk' };
    const ui = useUiStore();
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(true);
    const loadSpy = vi.spyOn(store, 'loadBuckets').mockResolvedValue([]);

    const wrapper = mountWith(BucketToolbar);
    await flushPromises();
    await wrapper.find('[data-testid="bucket-add"]').trigger('click');
    await flushPromises();
    expect(openSpy).toHaveBeenCalledWith('add-bucket');
  });

  it('ACL 入口携带选中 bucket 打开 update-bucket', async () => {
    const store = await seedBuckets();
    const ui = useUiStore();
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(false);
    const wrapper = mountWith(BucketToolbar);
    await flushPromises();

    store.bucketSelected = BUCKETS[1];
    await flushPromises();
    await wrapper.find('[data-testid="bucket-acl"]').trigger('click');
    await flushPromises();
    expect(openSpy).toHaveBeenCalledWith('update-bucket', { bucketInfo: BUCKETS[1] });
  });
});