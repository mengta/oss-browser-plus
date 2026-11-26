import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore, disposeSystemTheme, resolveThemeMode } from '@renderer/stores/ui.js';

// V-04（P7a/R-P7-05）：系统主题监听必须可解绑，重复 setTheme 不重复注册。
function installCountingMatchMedia(matches) {
  const listeners = new Set();
  const mq = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (type, fn) => listeners.add(type === 'change' ? fn : null),
    removeEventListener: (type, fn) => listeners.delete(fn),
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    dispatch: () => {
      for (const fn of listeners) fn();
    },
    listenerCount: () => listeners.size,
  };
  window.matchMedia = () => mq;
  return mq;
}

describe('ui store 主题监听解绑（V-04）', () => {
  let mq;

  beforeEach(() => {
    setActivePinia(createPinia());
    disposeSystemTheme();
    mq = installCountingMatchMedia(false);
  });

  afterEach(() => {
    disposeSystemTheme();
    vi.restoreAllMocks();
  });

  it('setTheme(system) 注册一次，重复调用不重复注册', () => {
    const ui = useUiStore();
    ui.setTheme('system');
    expect(mq.listenerCount()).toBe(1);
    ui.setTheme('system');
    ui.setTheme('dark');
    expect(mq.listenerCount()).toBe(1);
  });

  it('disposeSystemTheme 移除监听且幂等', () => {
    const ui = useUiStore();
    ui.setTheme('system');
    expect(disposeSystemTheme()).toBe(true);
    expect(mq.listenerCount()).toBe(0);
    expect(disposeSystemTheme()).toBe(false);
  });

  it('解绑后系统主题变化不再改写 theme', () => {
    const ui = useUiStore();
    ui.setTheme('system');
    ui.theme = resolveThemeMode('dark');
    disposeSystemTheme();
    mq.dispatch();
    expect(ui.theme).toBe('dark');
  });
});