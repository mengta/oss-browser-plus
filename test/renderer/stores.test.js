import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createRendererStore } from '@renderer/stores/index.js';
import { useBootstrapStore } from '@renderer/stores/bootstrap.js';
import { useLangStore } from '@renderer/stores/lang.js';
import { useToastStore } from '@renderer/stores/toast.js';
import { useUiStore, MAX_DEPTH } from '@renderer/stores/ui.js';
import { bootstrapFixture } from './fixtures/bootstrap.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('bootstrap store', () => {
  it('init 幂等且只读', async () => {
    const store = useBootstrapStore();
    const first = await store.init();
    const second = await store.init();
    expect(first.appVersion).toBe(bootstrapFixture.appVersion);
    expect(second).toBe(first);
    expect(store.ready).toBe(true);
  });
});

describe('lang store', () => {
  it('setLocale 持久化并更新状态', () => {
    const store = useLangStore();
    expect(store.setLocale('en-US')).toBe('en-US');
    expect(localStorage.getItem('lang')).toBe('en-US');
    expect(store.locale).toBe('en-US');
  });
});

describe('toast store', () => {
  it('去重、自动消失与复制', async () => {
    vi.useFakeTimers();
    const store = useToastStore();
    const id = store.push('boom', 'danger', 1000);
    expect(id).not.toBe(null);
    expect(store.push('boom', 'danger', 1000)).toBe(null);
    expect(store.count).toBe(1);

    vi.advanceTimersByTime(1100);
    expect(store.count).toBe(0);
    vi.useRealTimers();

    const copied = await store.copy({ message: 'text-to-copy' });
    expect(copied.ok).toBe(true);
  });
});

describe('ui store', () => {
  it('同 name 不重复压栈且深度上限 2', async () => {
    const store = useUiStore();
    const p1 = store.open('a');
    expect(p1).toBeInstanceOf(Promise);
    expect(store.open('a')).toBe(null);
    store.open('b');
    expect(store.open('c')).toBe(null);
    expect(store.depth).toBe(MAX_DEPTH);
  });

  it('任何关闭路径都 resolve', async () => {
    const store = useUiStore();
    const pa = store.open('a');
    store.close('a', 'closed');
    await expect(pa).resolves.toBe('closed');

    const pb = store.open('b');
    store.closeAll('all');
    await expect(pb).resolves.toBe('all');
    expect(store.depth).toBe(0);
  });
});

describe('createRendererStore', () => {
  it('返回独立的 pinia 实例', () => {
    const first = createRendererStore();
    const second = createRendererStore();

    expect(typeof first.install).toBe('function');
    expect(first).not.toBe(second);
  });
});
