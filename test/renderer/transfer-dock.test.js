import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { useTransferStore } from '@renderer/stores/transfer.js';
import TransferDock from '@renderer/components/business/transfer/TransferDock.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useAuthStore } from '@renderer/stores/auth.js';

// B3-08：传输中心契约（折叠双计数口径 / 双 tab / 徽标 / 关闭）

function installTransfer() {
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.transfer = {
    subscribe: () => 'sub-1',
    unsubscribe() {},
    pause: () => Promise.resolve({ ok: true, data: true }),
    resume: () => Promise.resolve({ ok: true, data: true }),
    clear: () => Promise.resolve({ ok: true, data: true }),
    createUpload: () => Promise.resolve({ ok: true, data: { taskId: 'up-x' } }),
    createDownload: () => Promise.resolve({ ok: true, data: { taskId: 'down-x' } }),
    scanFolder: () => Promise.resolve({ ok: true, data: [] }),
    ensureDirs: (paths) => Promise.resolve({ ok: true, data: paths }),
  };
  window.ossBrowser.storage = window.ossBrowser.storage || {
    readProgress: () => Promise.resolve({ ok: true, data: { exists: false, content: '' } }),
    writeProgress: () => Promise.resolve({ ok: true, data: true }),
  };
}

function mountWith(component) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, { global: { plugins: [pinia, createRendererI18n()] } });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.transfer;
  vi.restoreAllMocks();
});

function seed() {
  installTransfer();
  useAuthStore().info = { id: 'LTAI5tDock', secret: 'sk' };
  const store = useTransferStore();
  store.subscribe();
  // 构造计数口径：总数 4，活跃（running/waiting/verifying/stopped）2 → done=2
  store.pushTask('up-1', { region: 'r', from: { name: 'a' }, to: { bucket: 'b', key: 'a' } });
  store.pushTask('up-2', { region: 'r', from: { name: 'b' }, to: { bucket: 'b', key: 'b' } });
  store.uploads[0].status = 'finished';
  store.uploads[1].status = 'running';
  store.pushTask('down-1', { region: 'r', from: { bucket: 'b', key: 'x' }, to: { name: 'x', path: 'x' } }, 'download');
  store.downloads[0].status = 'failed';
  return store;
}

describe('TransferDock：折叠态', () => {
  it('双计数口径（upDone = 总数 − 活跃；downDone 同）：2/2 与 1/1', async () => {
    const store = seed();
    const wrapper = mountWith(TransferDock);
    await flushPromises();
    expect(store.uploadDone).toBe(1);
    expect(store.downloadDone).toBe(1);
    expect(wrapper.find('[data-testid="dock-upload"]').text()).toContain('1/2');
    expect(wrapper.find('[data-testid="dock-download"]').text()).toContain('1/1');
    expect(wrapper.find('[data-testid="transfer-tabs"]').exists()).toBe(false);
  });

  it('点击上传/下载计数展开对应 tab', async () => {
    seed();
    const wrapper = mountWith(TransferDock);
    await flushPromises();
    await wrapper.find('[data-testid="dock-upload"]').trigger('click');
    await flushPromises();
    expect(useTransferStore().visible).toBe(true);
    expect(useTransferStore().activeTab).toBe('upload');
    expect(wrapper.find('[data-testid="uploads-panel"]').exists()).toBe(true);

    await wrapper.find('[data-testid="tab-download"] a').trigger('click');
    await flushPromises();
    expect(useTransferStore().activeTab).toBe('download');
    expect(wrapper.find('[data-testid="downloads-panel"]').exists()).toBe(true);
  });
});

describe('TransferDock：展开态与关闭', () => {
  it('双 tab 徽标计数 + active 高亮 + 关闭回到折叠', async () => {
    const store = seed();
    store.setVisible(true, 'upload');
    const wrapper = mountWith(TransferDock);
    await flushPromises();

    expect(wrapper.find('[data-testid="tab-upload-count"]').text()).toBe('1/2');
    expect(wrapper.find('[data-testid="tab-download-count"]').text()).toBe('1/1');
    expect(wrapper.find('[data-testid="tab-upload"]').classes()).toContain('active');
    expect(wrapper.find('[data-testid="tab-download"]').classes()).not.toContain('active');

    await wrapper.find('[data-testid="tab-download"] a').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="tab-download"]').classes()).toContain('active');

    await wrapper.find('[data-testid="dock-close"]').trigger('click');
    await flushPromises();
    expect(store.visible).toBe(false);
    expect(wrapper.find('[data-testid="dock-upload"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="transfer-tabs"]').exists()).toBe(false);
  });

  it('getter 口径：finished/failed 计入 done，running/stopped/waiting 不计', async () => {
    const store = seed();
    store.pushTask('up-3', { region: 'r', from: { name: 'c' }, to: { bucket: 'b', key: 'c' } });
    store.uploads[2].status = 'stopped';
    store.pushTask('up-4', { region: 'r', from: { name: 'd' }, to: { bucket: 'b', key: 'd' } });
    store.uploads[3].status = 'failed';
    store.pushTask('up-5', { region: 'r', from: { name: 'e' }, to: { bucket: 'b', key: 'e' } });
    store.uploads[4].status = 'waiting';
    // 总数 5；活跃 running+stopped+waiting = 3 → done = 2（finished + failed）
    expect(store.uploadDone).toBe(2);
  });
});