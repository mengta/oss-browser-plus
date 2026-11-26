import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import TopBar from '@renderer/components/business/TopBar.vue';
import ErrorBoundary from '@renderer/components/base/ErrorBoundary.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useUiStore } from '@renderer/stores/ui.js';

// B4-01/B4-06/B4-12：TopBar / 错误边界 / 端口就绪门（自动更新已移除）

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
    ],
  });
}

function mountBar(options) {
  const pinia = getActivePinia() || createPinia();
  const router = makeRouter();
  const i18n = createRendererI18n();
  const wrapper = mount(TopBar, {
    global: { plugins: [pinia, router, i18n] },
  });
  return { wrapper, pinia, router, i18n };
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('TopBar：品牌/登录态/语言/退出/升级角标', () => {
  it('未登录：仅品牌图标 + mini 入口（设置/关于/语言），无退出', async () => {
    const { wrapper } = mountBar();
    await flushPromises();
    const brand = wrapper.find('.navbar-brand');
    expect(brand.text()).toBe('');
    expect(brand.attributes('title')).toBe('OSS浏览器');
    expect(brand.find('.brand-logo').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-version"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="topbar-settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-about"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-lang"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="topbar-logout"]').exists()).toBe(false);
  });

  it('已登录：文件/用户/收藏/设置/关于/账号/退出；STS 隐藏用户与收藏', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'LTAI-test', secret: 'sk' };
    const { wrapper } = mountBar();
    await flushPromises();
    expect(wrapper.find('[data-testid="topbar-files"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-users"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-fav"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-logout"]').exists()).toBe(true);

    useAuthStore(pinia).info = { id: 'STS.temp', secret: 'sk' };
    await flushPromises();
    expect(wrapper.find('[data-testid="topbar-users"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="topbar-fav"]').exists()).toBe(false);
  });

  it('退出：确认后清空账号与文件页状态并跳转 /login', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'LTAI-test', secret: 'sk' };
    const { wrapper, router } = mountBar();
    const ui = useUiStore(pinia);
    vi.spyOn(ui, 'confirm').mockResolvedValue(true);
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue();
    await flushPromises();

    await wrapper.find('[data-testid="topbar-logout"]').trigger('click');
    await flushPromises();
    expect(useAuthStore(pinia).info).toEqual({});
    expect(useFilesStore(pinia).bucket).toBe('');
    expect(pushSpy).toHaveBeenCalledWith('/login');
  });
});

describe('ErrorBoundary：捕获渲染异常与重试', () => {
  function Broken() {
    return { setup() { throw new Error('boom-render'); }, template: '<div/>' };
  }

  it('捕获子树异常显示提示；重试 emit 与关闭', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: { plugins: [getActivePinia() || createPinia(), makeRouter(), createRendererI18n()] },
      slots: { default: Broken() },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="error-boundary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="error-boundary-message"]').text()).toContain('页面渲染异常');

    await wrapper.find('[data-testid="error-boundary-retry"]').trigger('click');
    expect(wrapper.emitted('retry')).toBeTruthy();

    await wrapper.find('[data-testid="error-boundary-close"]').trigger('click');
    await flushPromises();
  });
});

describe('portReady：静态服务端口就绪门', () => {
  it('端口就绪返回数值；未就绪抛 PORT_NOT_READY', async () => {
    window.ossBrowser.system.getStaticServerPort = () => Promise.resolve({ ok: true, data: 7123 });
    const { portReady } = await import('@renderer/services/api.js');
    expect(await portReady()).toBe(7123);

    vi.resetModules();
    window.ossBrowser.system.getStaticServerPort = () =>
      Promise.resolve({ ok: false, code: 'UNAVAILABLE', message: 'not ready' });
    const fresh = await import('@renderer/services/api.js');
    await expect(fresh.portReady()).rejects.toMatchObject({ code: 'PORT_NOT_READY' });
  });
});