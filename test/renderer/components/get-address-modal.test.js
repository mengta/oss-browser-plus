import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import GetAddressModal from '@renderer/components/business/modals/GetAddressModal.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';

function mountModal(item) {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(GetAddressModal, {
    props: { item, currentInfo: { region: 'oss-cn-hangzhou', bucket: 'b' } },
    global: {
      plugins: [pinia, createRendererI18n('zh-CN')],
      stubs: { QrCodeCard: true },
    },
  });
}

const ITEM = { name: 'a.txt', path: 'pre/a.txt', url: 'https://b.example.com/pre/a.txt' };

describe('GetAddressModal：可访问性探测', () => {
  it('探测 200 时直接展示可用地址', async () => {
    window.ossBrowser.oss.probeUrl = () =>
      Promise.resolve({ ok: true, data: { status: 200, ok: true, body: '' } });
    const wrapper = mountModal(ITEM);
    await flushPromises();

    expect(wrapper.find('[data-testid="address-ready"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('403 时进入签名链接步骤', async () => {
    window.ossBrowser.oss.probeUrl = () =>
      Promise.resolve({ ok: true, data: { status: 403, ok: false, body: 'denied' } });
    const wrapper = mountModal(ITEM);
    await flushPromises();

    expect(wrapper.find('[data-testid="address-sign"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('探测通道失败时进入签名链接步骤，不显示错误', async () => {
    window.ossBrowser.oss.probeUrl = () =>
      Promise.resolve({ ok: false, code: 'PROBE_FAILED', message: 'app:probe-url failed' });
    const wrapper = mountModal(ITEM);
    await flushPromises();

    expect(wrapper.find('[data-testid="address-sign"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="address-error"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('非 http(s) url 不发探测，直接进入签名链接步骤', async () => {
    const probe = vi.fn(() => Promise.resolve({ ok: true, data: { status: 200, ok: true, body: '' } }));
    window.ossBrowser.oss.probeUrl = probe;
    const wrapper = mountModal({ name: 'a.txt', path: 'pre/a.txt', url: 'oss://b/pre/a.txt' });
    await flushPromises();

    expect(probe).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="address-sign"]').exists()).toBe(true);
    wrapper.unmount();
  });
});