import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useBootstrapStore } from '@renderer/stores/bootstrap.js';
import WindowControls from '@renderer/components/base/WindowControls.vue';

// T-V3-UI-10：无边框标题栏自绘窗口控制（最小化/最大化还原/关闭）

function mountControls() {
  const pinia = getActivePinia() || createPinia();
  const i18n = createRendererI18n();
  const wrapper = mount(WindowControls, {
    global: { plugins: [pinia, i18n] },
  });
  return { wrapper, pinia };
}

function installSystem(overrides = {}) {
  const system = {
    minimizeWindow: vi.fn(() => Promise.resolve({ ok: true, data: true })),
    toggleMaximizeWindow: vi.fn(() => Promise.resolve({ ok: true, data: true })),
    closeWindow: vi.fn(() => Promise.resolve({ ok: true, data: true })),
    isWindowMaximized: vi.fn(() => Promise.resolve({ ok: true, data: false })),
    subscribeWindowState: vi.fn(() => Promise.resolve({ ok: true, data: 'window-1' })),
    unsubscribeWindowState: vi.fn(() => Promise.resolve({ ok: true, data: true })),
    ...overrides,
  };
  window.ossBrowser = { system };
  return system;
}

function maximizeIconNodeCount(wrapper) {
  return wrapper.find('[data-testid="window-maximize"] svg').element.childElementCount;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

afterEach(() => {
  delete window.ossBrowser;
  vi.restoreAllMocks();
});

describe('WindowControls：VS Code 风格自绘标题栏按钮', () => {
  it('渲染三个按钮并调用主进程窗口控制 API', async () => {
    const system = installSystem();
    const { wrapper } = mountControls();
    await flushPromises();

    expect(wrapper.find('[data-testid="window-controls"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="window-minimize"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="window-maximize"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(true);
    expect(system.isWindowMaximized).toHaveBeenCalled();
    expect(system.subscribeWindowState).toHaveBeenCalled();

    await wrapper.find('[data-testid="window-minimize"]').trigger('click');
    await wrapper.find('[data-testid="window-maximize"]').trigger('click');
    await wrapper.find('[data-testid="window-close"]').trigger('click');
    await flushPromises();

    expect(system.minimizeWindow).toHaveBeenCalledTimes(1);
    expect(system.toggleMaximizeWindow).toHaveBeenCalledTimes(1);
    expect(system.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('最大化状态：初始查询与事件回调切换还原图标', async () => {
    let emitState = null;
    installSystem({
      isWindowMaximized: vi.fn(() => Promise.resolve({ ok: true, data: true })),
      subscribeWindowState: vi.fn((callback) => {
        emitState = callback;
        return Promise.resolve({ ok: true, data: 'window-1' });
      }),
    });
    const { wrapper } = mountControls();
    await flushPromises();

    const restoredNodes = maximizeIconNodeCount(wrapper);
    expect(restoredNodes).toBeGreaterThan(1);

    emitState(false);
    await flushPromises();
    expect(maximizeIconNodeCount(wrapper)).toBe(1);

    emitState(true);
    await flushPromises();
    expect(maximizeIconNodeCount(wrapper)).toBe(restoredNodes);
  });

  it('macOS 平台隐藏自绘按钮（保留系统交通灯）', async () => {
    installSystem();
    const { wrapper, pinia } = mountControls();
    useBootstrapStore(pinia).snapshot = { platform: 'darwin' };
    await flushPromises();
    expect(wrapper.find('[data-testid="window-controls"]').exists()).toBe(false);
  });

  it('非 Electron 环境（无 window.ossBrowser）不抛错', async () => {
    delete window.ossBrowser;
    const { wrapper } = mountControls();
    await flushPromises();

    await wrapper.find('[data-testid="window-minimize"]').trigger('click');
    await wrapper.find('[data-testid="window-maximize"]').trigger('click');
    await wrapper.find('[data-testid="window-close"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(true);
  });

  it('卸载时取消窗口状态订阅', async () => {
    const system = installSystem();
    const { wrapper } = mountControls();
    await flushPromises();

    wrapper.unmount();
    expect(system.unsubscribeWindowState).toHaveBeenCalledWith('window-1');
  });
});