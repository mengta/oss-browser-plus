import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@renderer/stores/auth.js';
import * as SecureStore from '@renderer/services/secure-store.js';

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  globalThis.__testSafeStorage = false;
  globalThis.__testGcmFail = false;
  delete globalThis.__testOssFail;
  setActivePinia(createPinia());
});

describe('auth store', () => {
  it('login 成功写入 auth-info 与历史、可选记住（密文无明文）', async () => {
    const store = useAuthStore();
    await store.login({ id: 'LTAI1', secret: 's1', region: 'oss-cn-hangzhou' }, { remember: true });

    expect(store.isLoggedIn).toBe(true);
    expect(localStorage.getItem('auth-info').indexOf('enc:v2d:')).toBe(0);
    expect(localStorage.getItem('auth-info').indexOf('s1')).toBe(-1);
    expect(store.histories[0].id).toBe('LTAI1');
    expect(store.remembered.id).toBe('LTAI1');
    expect(localStorage.getItem('auth-keep').indexOf('enc:v2d:')).toBe(0);
  });

  it('login 失败抛错、不写入 auth-info、记录 lastError', async () => {
    globalThis.__testOssFail = true;
    const store = useAuthStore();

    await expect(store.login({ id: 'X', secret: 'Y' }, {})).rejects.toBeTruthy();
    expect(localStorage.getItem('auth-info')).toBe(null);
    expect(store.lastError.code).toBe('InvalidAccessKeyId');
  });

  it('logout 清空 info 保留历史；switchAccount 可切回（仅 remember 写历史，等价原版）', async () => {
    const store = useAuthStore();
    await store.login({ id: 'A1', secret: 's' }, { remember: true });
    await store.login({ id: 'A2', secret: 's' }, { remember: true });
    // 不勾选"记住秘钥"时不写历史（等价原 onSubmit 行为）
    await store.login({ id: 'A3', secret: 's' }, {});

    expect(store.histories.length).toBe(2);
    expect(store.histories.some((h) => h.id === 'A3')).toBe(false);
    store.logout();
    expect(store.isLoggedIn).toBe(false);
    expect(store.histories.length).toBe(2);

    const back = store.switchAccount('A1');
    expect(back.id).toBe('A1');
    expect(store.info.id).toBe('A1');
  });

  it('remember/unremember/removeHistory 语义', async () => {
    const store = useAuthStore();
    await store.login({ id: 'R1', secret: 's' }, { remember: true });

    expect(store.getRemember().id).toBe('R1');
    store.unremember();
    expect(store.getRemember()).toEqual({});

    store.removeHistory('R1');
    expect(store.histories.length).toBe(0);
  });
});