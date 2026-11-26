import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AddressBar from '@renderer/components/business/files/AddressBar.vue';
import SettingsModal from '@renderer/components/business/modals/SettingsModal.vue';
import TopBar from '@renderer/components/business/TopBar.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useSettingsStore } from '@renderer/stores/settings.js';

// 升级回归审计修复：地址栏刷新/主页/保存首页；设置“保存历史记录长度”；临时凭证倒计时

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
    ],
  });
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, router, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('地址栏：刷新 / 主页 / 保存为首页', () => {
  it('三按钮存在；保存首页写入 auth-info.address 并记住当前地址', async () => {
    const pinia = getActivePinia();
    const auth = useAuthStore(pinia);
    auth.info = { id: 'LTAI-test', secret: 'sk' };
    const files = useFilesStore(pinia);
    vi.spyOn(files, 'navigate').mockResolvedValue();

    const wrapper = mountWith(AddressBar);
    await flushPromises();
    expect(wrapper.find('[data-testid="address-refresh"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="address-home"]').exists()).toBe(true);

    const saveBtn = wrapper.find('[data-testid="address-save-home"]');
    expect(saveBtn.exists()).toBe(true);

    await wrapper.find('[data-testid="address-input"]').setValue('oss://demo/pre/');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const saveSpy = vi.spyOn(auth, 'saveToAuthInfo').mockResolvedValue({});
    await saveBtn.trigger('click');
    expect(saveSpy).toHaveBeenCalledWith({ address: 'oss://demo/pre/' });
  });
});

describe('设置页：保存历史记录长度', () => {
  it('存在输入项并按 changes 保存到 settings', async () => {
    const pinia = getActivePinia();
    const wrapper = mountWith(SettingsModal);
    await flushPromises();

    const input = wrapper.find('[data-testid="settings-historiesLength"]');
    expect(input.exists()).toBe(true);

    const settings = useSettingsStore(pinia);
    const spy = vi.spyOn(settings, 'debouncedSet');
    await input.setValue(200);
    await input.trigger('change');
    await flushPromises();
    expect(spy).toHaveBeenCalledWith('historiesLength', 200);
  });
});

describe('临时凭证：倒计时与 validUntil 浮窗', () => {
  it('显示 HH:mm:ss 倒计时，hover 显示到期说明浮窗', async () => {
    const pinia = getActivePinia();
    const auth = useAuthStore(pinia);
    auth.info = {
      id: 'STS.temp',
      secret: 'sk',
      expiration: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    const wrapper = mountWith(TopBar);
    await flushPromises();

    const cert = wrapper.find('[data-testid="topbar-temp-cert"]');
    expect(cert.exists()).toBe(true);
    expect(cert.text()).toMatch(/\d{2}:\d{2}:\d{2}/);

    await cert.trigger('mouseenter');
    await flushPromises();
    expect(document.querySelector('.hint-pop')).toBeTruthy();
    await cert.trigger('mouseleave');
  });
});