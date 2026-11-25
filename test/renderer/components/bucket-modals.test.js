import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import AddBucketModal from '@renderer/components/business/modals/AddBucketModal.vue';
import UpdateBucketModal from '@renderer/components/business/modals/UpdateBucketModal.vue';
import BucketMultipartModal from '@renderer/components/business/modals/BucketMultipartModal.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { BUCKET_ACL, REGIONS } from '@renderer/services/const-data.js';

// B3-04：Bucket 管理三弹窗契约

let ossCalls = [];

function installOss(overrides) {
  ossCalls = [];
  const base = {
    createBucket: (auth, region, name, acl, sc) => {
      ossCalls.push(['createBucket', region, name, acl, sc]);
      return Promise.resolve({ ok: true, data: {} });
    },
    getBucketACL: (auth, region, name) => {
      ossCalls.push(['getBucketACL', region, name]);
      return Promise.resolve({ ok: true, data: { acl: 'public-read' } });
    },
    updateBucketACL: (auth, region, name, acl) => {
      ossCalls.push(['updateBucketACL', region, name, acl]);
      return Promise.resolve({ ok: true, data: {} });
    },
    listAllUploads: (auth, region, name) => {
      ossCalls.push(['listAllUploads', region, name]);
      return Promise.resolve({
        ok: true,
        data: [
          { name: 'big-a.zip', uploadId: 'U-1', initiated: '2024-01-02T03:04:05.000Z', storageClass: 'Standard' },
          { name: 'big-b.zip', uploadId: 'U-2', initiated: '2024-01-03T03:04:05.000Z', storageClass: 'Standard' },
        ],
      });
    },
    abortAllUploads: (auth, region, name, uploads) => {
      ossCalls.push(['abortAllUploads', region, name, uploads.map((u) => u.uploadId)]);
      return Promise.resolve({ ok: true, data: {} });
    },
  };
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = Object.assign(base, overrides || {});
}

function mountWith(component, props) {
  // 与用例内 useUiStore() 共享同一 active pinia（spy 生效的前提）
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
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

describe('AddBucketModal：校验/联动/提交', () => {
  it('默认值：region 首项/ACL private/storageClass Standard', async () => {
    installOss({});
    const wrapper = mountWith(AddBucketModal);
    await flushPromises();
    expect(wrapper.find('[data-testid="add-bucket-region"]').element.value).toBe(REGIONS[0].id);
    expect(wrapper.find('[data-testid="add-bucket-acl"]').element.value).toBe(BUCKET_ACL[0].acl);
    expect(wrapper.find('[data-testid="add-bucket-sc"]').element.value).toBe('Standard');
  });

  it('名称正则校验失败 → Toast 且不发请求；合法名 → createBucket(region,name,acl,sc)', async () => {
    installOss({});
    const ui = useUiStore();
    const alertSpy = vi.spyOn(ui, 'alert');
    const wrapper = mountWith(AddBucketModal);
    await flushPromises();

    await wrapper.find('[data-testid="add-bucket-name"]').setValue('Bad_Name');
    await wrapper.find('[data-testid="add-bucket-submit"]').trigger('click');
    await flushPromises();
    expect(ossCalls.length).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="add-bucket-name"]').setValue('my-bucket-01');
    await wrapper.find('[data-testid="add-bucket-acl"]').setValue('public-read');
    await flushPromises();
    // ACL 非 private 触发风险警示
    expect(alertSpy).toHaveBeenCalledTimes(1);

    await wrapper.find('[data-testid="add-bucket-submit"]').trigger('click');
    await flushPromises();
    expect(ossCalls[0]).toEqual(['createBucket', REGIONS[0].id, 'my-bucket-01', 'public-read', 'Standard']);
    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });

  it('region 切换重置 storageClass=Standard 且选项随区域（getStorageClasses 3 档）', async () => {
    installOss({});
    const wrapper = mountWith(AddBucketModal);
    await flushPromises();
    const scSelect = wrapper.find('[data-testid="add-bucket-sc"]');
    expect(scSelect.findAll('option').length).toBe(3);

    await scSelect.setValue('Archive');
    await wrapper.find('[data-testid="add-bucket-region"]').setValue(REGIONS[1].id);
    await flushPromises();
    expect(wrapper.find('[data-testid="add-bucket-sc"]').element.value).toBe('Standard');
  });
});

describe('UpdateBucketModal：回显与提交', () => {
  const bucketInfo = { name: 'demo-b', region: 'oss-cn-hangzhou' };

  it('name/region 只读；getBucketACL 回显 ACL', async () => {
    installOss({});
    const wrapper = mountWith(UpdateBucketModal, { bucketInfo });
    await flushPromises();
    expect(wrapper.find('[data-testid="update-bucket-name"]').attributes('readonly')).toBeDefined();
    expect(wrapper.find('[data-testid="update-bucket-region"]').attributes('readonly')).toBeDefined();
    expect(ossCalls[0]).toEqual(['getBucketACL', 'oss-cn-hangzhou', 'demo-b']);
    expect(wrapper.find('[data-testid="update-bucket-acl"]').element.value).toBe('public-read');
  });

  it('getBucketACL 返回 default（无选项）不回显，保持默认值', async () => {
    installOss({ getBucketACL: () => Promise.resolve({ ok: true, data: { acl: 'default' } }) });
    const wrapper = mountWith(UpdateBucketModal, { bucketInfo });
    await flushPromises();
    expect(wrapper.find('[data-testid="update-bucket-acl"]').element.value).toBe('private');
  });

  it('提交 updateBucketACL 并 close(true)', async () => {
    installOss({});
    const wrapper = mountWith(UpdateBucketModal, { bucketInfo });
    await flushPromises();
    await wrapper.find('[data-testid="update-bucket-acl"]').setValue('private');
    await wrapper.find('[data-testid="update-bucket-submit"]').trigger('click');
    await flushPromises();
    expect(ossCalls[1]).toEqual(['updateBucketACL', 'oss-cn-hangzhou', 'demo-b', 'private']);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });
});

describe('BucketMultipartModal：列表/过滤/分页/删除', () => {
  const bucketInfo = { name: 'demo-b', region: 'oss-cn-hangzhou' };

  it('挂载即 listAllUploads 并渲染行（名称/uploadId/时间）', async () => {
    installOss({});
    const wrapper = mountWith(BucketMultipartModal, { bucketInfo });
    await flushPromises();
    expect(ossCalls[0][0]).toBe('listAllUploads');
    const rows = wrapper.findAll('[data-testid="multipart-table"] tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].text()).toContain('big-a.zip');
    expect(rows[0].text()).toContain('U-1');
  });

  it('搜索过滤（名称/uploadId）', async () => {
    installOss({});
    const wrapper = mountWith(BucketMultipartModal, { bucketInfo });
    await flushPromises();
    await wrapper.find('[data-testid="multipart-search"]').setValue('U-2');
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="multipart-table"] tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].text()).toContain('big-b.zip');
  });

  it('全选/取消全选与删除所选（ui.confirm 确认后 abortAllUploads 传选中项）', async () => {
    installOss({});
    const ui = useUiStore();
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(true);
    const wrapper = mountWith(BucketMultipartModal, { bucketInfo });
    await flushPromises();

    await wrapper.find('[data-testid="multipart-check-all"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="multipart-delete-selected"]').text()).toContain('(2)');

    await wrapper.find('[data-testid="multipart-delete-selected"]').trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const abortCall = ossCalls.find((c) => c[0] === 'abortAllUploads');
    expect(abortCall[3]).toEqual(['U-1', 'U-2']);
  });

  it('单条删除仅终止该 uploadId；取消确认无请求', async () => {
    installOss({});
    const ui = useUiStore();
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(false);
    const wrapper = mountWith(BucketMultipartModal, { bucketInfo });
    await flushPromises();

    await wrapper.findAll('[data-testid="multipart-row-delete"]')[0].trigger('click');
    await flushPromises();
    expect(ossCalls.filter((c) => c[0] === 'abortAllUploads').length).toBe(0);

    confirmSpy.mockResolvedValue(true);
    await wrapper.findAll('[data-testid="multipart-row-delete"]')[0].trigger('click');
    await flushPromises();
    const abortCall = ossCalls.find((c) => c[0] === 'abortAllUploads');
    expect(abortCall[3]).toEqual(['U-1']);
  });

  it('limitTo 20 分期：21 条时首屏 20 行，loadNext 显示全部', async () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      name: 'f' + i + '.zip',
      uploadId: 'U-' + i,
      initiated: '2024-01-02T03:04:05.000Z',
    }));
    installOss({ listAllUploads: () => Promise.resolve({ ok: true, data: many }) });
    const wrapper = mountWith(BucketMultipartModal, { bucketInfo });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="multipart-table"] tbody tr').length).toBe(20);

    await wrapper.find('[data-testid="multipart-more"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="multipart-table"] tbody tr').length).toBe(21);
  });

  it('空列表显示 nodata', async () => {
    installOss({ listAllUploads: () => Promise.resolve({ ok: true, data: [] }) });
    const wrapper = mountWith(BucketMultipartModal, { bucketInfo });
    await flushPromises();
    expect(wrapper.find('[data-testid="multipart-table"]').exists()).toBe(false);
  });
});