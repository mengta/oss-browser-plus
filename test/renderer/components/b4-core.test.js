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
import { upgradeService } from '@renderer/services/upgrade.js';

// B4-01/B4-05/B4-06/B4-12：TopBar / 升级服务 / 错误边界 / 端口就绪门

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
  it('未登录：品牌文案 + mini 入口（设置/关于/语言），无退出', async () => {
    const { wrapper } = mountBar();
    await flushPromises();
    expect(wrapper.find('.navbar-brand').text()).toContain('OSS浏览器');
    expect(wrapper.find('[data-testid="topbar-settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-about"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="topbar-lang"]').exists()).toBe(true);
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

  it('语言切换：string: 前缀兼容原版 ng-options 值', async () => {
    const { wrapper, i18n } = mountBar();
    await flushPromises();
    await wrapper.find('[data-testid="topbar-lang"]').setValue('string:en-US');
    await flushPromises();
    expect(i18n.global.locale.value).toBe('en-US');
    expect(localStorage.getItem('lang')).toBe('en-US');
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

  it('升级角标：ui.upgrade.hasNew 为真时显示 new', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'LTAI-test', secret: 'sk' };
    const { wrapper } = mountBar();
    await flushPromises();
    expect(wrapper.find('[data-testid="topbar-upgrade-new"]').exists()).toBe(false);
    useUiStore(pinia).setUpgrade({ hasNew: true });
    await flushPromises();
    expect(wrapper.find('[data-testid="topbar-upgrade-new"]').exists()).toBe(true);
  });
});

describe('upgradeService：白名单封装与静默失败', () => {
  it('check 成功返回 data；NETWORK 抛错；UNAVAILABLE 返回 null', async () => {
    window.ossBrowser.upgrade.check = () =>
      Promise.resolve({ ok: true, data: { hasNew: true, version: '1.21.0' } });
    expect(await upgradeService.check()).toEqual({ hasNew: true, version: '1.21.0' });

    window.ossBrowser.upgrade.check = () => Promise.resolve({ ok: false, code: 'NETWORK', message: 'offline' });
    await expect(upgradeService.check()).rejects.toMatchObject({ code: 'NETWORK' });

    window.ossBrowser.upgrade.check = () => Promise.resolve({ ok: false, code: 'UNAVAILABLE', message: 'x' });
    expect(await upgradeService.check()).toBe(null);
  });

  it('checkAndUpdate：更新 ui 角标且失败静默', async () => {
    const ui = useUiStore();
    window.ossBrowser.upgrade.check = () =>
      Promise.resolve({ ok: true, data: { hasNew: true, version: '1.22.0' } });
    await upgradeService.checkAndUpdate(ui);
    expect(ui.upgrade.hasNew).toBe(true);
    expect(ui.upgrade.version).toBe('1.22.0');

    window.ossBrowser.upgrade.check = () => Promise.reject(new Error('boom'));
    await expect(upgradeService.checkAndUpdate(ui)).resolves.toBe(null);
  });

  it('download/install 参数透传；subscribe 返回可解绑', async () => {
    const calls = [];
    window.ossBrowser.upgrade.download = (payload) => {
      calls.push(['download', payload]);
      return Promise.resolve({ ok: true, data: { finished: true } });
    };
    window.ossBrowser.upgrade.install = (payload) => {
      calls.push(['install', payload]);
      return Promise.resolve({ ok: true, data: true });
    };
    let cb = null;
    window.ossBrowser.upgrade.subscribe = (handler) => {
      cb = handler;
      return 'sub-1';
    };
    window.ossBrowser.upgrade.unsubscribe = (id) => {
      calls.push(['unsubscribe', id]);
      return Promise.resolve({ ok: true, data: true });
    };

    expect(await upgradeService.download({ version: '1.21.0', url: 'u' })).toEqual({ finished: true });
    expect(await upgradeService.install({ version: '1.21.0' })).toBe(true);
    expect(calls[0][1]).toEqual({ version: '1.21.0', url: 'u' });

    const ui = useUiStore();
    const off = upgradeService.track(ui);
    cb({ state: 'downloading', info: { progress: 42, version: '1.21.0' } });
    expect(ui.upgrade.state).toBe('downloading');
    expect(ui.upgrade.progress).toBe(42);
    off();
    expect(calls.some((c) => c[0] === 'unsubscribe')).toBe(true);
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