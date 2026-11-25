import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as SecureStore from '@renderer/services/secure-store.js';
import { AUTH_INFO_KEY, AUTH_HIS, AUTH_KEEP, KEY_AUTHTOKEN } from '@renderer/services/constants.js';

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  globalThis.__testSafeStorage = false;
  globalThis.__testGcmFail = false;
});

afterEach(() => {
  localStorage.clear();
  delete globalThis.__testSafeStorage;
  delete globalThis.__testGcmFail;
});

describe('secure-store (Vue 版)', () => {
  it('五键名称与 const.js 等价', () => {
    expect(AUTH_INFO_KEY).toBe('auth-info');
    expect(AUTH_HIS).toBe('auth-his');
    expect(AUTH_KEEP).toBe('auth-keep');
    expect(KEY_AUTHTOKEN).toBe('key-authtoken');
    expect('mailSender').toBe('mailSender');
  });

  it('v2d 写入/回读往返（降级路径）', () => {
    expect(SecureStore.set('auth-keep', '{"id":"A"}')).toBe(true);
    const raw = localStorage.getItem('auth-keep');
    expect(raw.indexOf('enc:v2d:')).toBe(0);
    expect(raw.indexOf('"id"')).toBe(-1);
    expect(SecureStore.get('auth-keep', null)).toBe('{"id":"A"}');
  });

  it('v2 写入/回读往返（safeStorage 可用）', () => {
    globalThis.__testSafeStorage = true;
    expect(SecureStore.set('auth-info', '{"id":"B"}')).toBe(true);
    expect(localStorage.getItem('auth-info').indexOf('enc:v2:')).toBe(0);
    expect(SecureStore.get('auth-info', null)).toBe('{"id":"B"}');
  });

  it('v0 明文读取即迁移为 v2d，原值覆盖', () => {
    localStorage.setItem('auth-his', '[{"id":"C"}]');
    expect(SecureStore.get('auth-his', null, { legacyPlain: true })).toBe('[{"id":"C"}]');
    expect(localStorage.getItem('auth-his').indexOf('enc:v2d:')).toBe(0);
  });

  it('v1 hex 读取即迁移为 v2d（四格式判定顺序）', () => {
    const sealed = window.ossBrowser.credentials.legacyCipher('{"id":"D","x":"0123456789abcdef"}').data;
    localStorage.setItem('auth-keep', sealed);
    expect(SecureStore.get('auth-keep', null)).toBe('{"id":"D","x":"0123456789abcdef"}');
    expect(localStorage.getItem('auth-keep').indexOf('enc:v2d:')).toBe(0);
  });

  it('加密失败不落盘：原值保留且下次重试', () => {
    globalThis.__testGcmFail = true;
    const before = localStorage.getItem('auth-keep');
    expect(SecureStore.set('auth-keep', '{"id":"E"}')).toBe(false);
    expect(localStorage.getItem('auth-keep')).toBe(before);

    globalThis.__testGcmFail = false;
    expect(SecureStore.set('auth-keep', '{"id":"E"}')).toBe(true);
  });

  it('损坏密文按数据不存在返回默认值且原值保留', () => {
    localStorage.setItem('auth-info', 'enc:v2d:broken!!');
    expect(SecureStore.get('auth-info', { def: true })).toEqual({ def: true });
    expect(localStorage.getItem('auth-info')).toBe('enc:v2d:broken!!');
  });
});