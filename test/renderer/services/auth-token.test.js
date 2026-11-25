import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AUTH_TOKEN_DEBOUNCE,
  createAuthTokenWriter,
  decodeAuthToken,
} from '@renderer/services/auth-token.js';
import * as SecureStore from '@renderer/services/secure-store.js';
import { KEY_AUTHTOKEN } from '@renderer/services/constants.js';

// 迁移自 ava test/unit/main/auth/login-authtoken.test.mjs（源 app/main/auth/login.js :107/:175）
// 断言逐条保留：v2 密文非明文 / 空串直写（D-10）/ v0 明文预置迁移 /
// 解析后 id/secret 可读 / 多次触发防抖仅最后一次生效。

function base64Of(obj) {
  const text = JSON.stringify(obj);
  return btoa(text);
}

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  // v2 主路径（与 ava 原用例一致：safeStorage 可用）
  globalThis.__testSafeStorage = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('authToken 防抖落盘', () => {
  it('flush 后 key-authtoken 为 v2 密文且不含明文', () => {
    const writer = createAuthTokenWriter();
    writer.schedule('token-plain-1');
    writer.flush();

    const raw = localStorage.getItem(KEY_AUTHTOKEN);
    expect(raw.indexOf('enc:v2:')).toBe(0);
    expect(raw.indexOf('token-plain-1')).toBe(-1);
    expect(SecureStore.get(KEY_AUTHTOKEN, '')).toBe('token-plain-1');
  });

  it('空串场景直写空串（空值语义保持，D-10）', () => {
    const writer = createAuthTokenWriter();
    writer.schedule('');
    expect(localStorage.getItem(KEY_AUTHTOKEN)).toBe('');
  });

  it('600ms 后自动落盘，等待期内未落盘', () => {
    vi.useFakeTimers();
    const writer = createAuthTokenWriter();
    writer.schedule('token-delay');

    vi.advanceTimersByTime(AUTH_TOKEN_DEBOUNCE - 1);
    expect(localStorage.getItem(KEY_AUTHTOKEN)).toBe(null);

    vi.advanceTimersByTime(1);
    expect(localStorage.getItem(KEY_AUTHTOKEN).indexOf('enc:v2:')).toBe(0);
  });

  it('多次触发防抖去抖：仅最后一次生效', () => {
    vi.useFakeTimers();
    const writer = createAuthTokenWriter();
    writer.schedule('token-A');
    writer.schedule('token-B');
    writer.schedule('token-C');
    vi.advanceTimersByTime(AUTH_TOKEN_DEBOUNCE);

    const raw = localStorage.getItem(KEY_AUTHTOKEN);
    expect(raw.indexOf('enc:v2:')).toBe(0);
    expect(raw.indexOf('token-A')).toBe(-1);
    expect(raw.indexOf('token-B')).toBe(-1);
    expect(SecureStore.get(KEY_AUTHTOKEN, '')).toBe('token-C');
  });

  it('预置 v0 明文：legacyPlain 读取回填一致且存储已迁移为 v2', () => {
    localStorage.setItem(KEY_AUTHTOKEN, 'plain-token-v0');
    const token = SecureStore.get(KEY_AUTHTOKEN, '', { legacyPlain: true });

    expect(token).toBe('plain-token-v0');
    expect(localStorage.getItem(KEY_AUTHTOKEN).indexOf('enc:v2:')).toBe(0);
  });
});

describe('authToken 解析', () => {
  it('空串返回 null', () => {
    expect(decodeAuthToken('')).toBe(null);
  });

  it('非法 base64/JSON 返回 null', () => {
    expect(decodeAuthToken('not-a-token')).toBe(null);
  });

  it('子账号 AK 授权码解析出 id/secret', () => {
    const info = { id: 'LTAI5tsub', secret: 'sub-secret' };
    const parsed = decodeAuthToken(base64Of(info));
    expect(parsed.id).toBe('LTAI5tsub');
    expect(parsed.secret).toBe('sub-secret');
  });

  it('完整授权码附带过期判定与有效期字符串', () => {
    const info = {
      id: 'STS.token',
      secret: 's',
      stoken: 'st',
      privilege: 'p',
      expiration: '2099-01-02T03:04:05.000Z',
      osspath: 'oss://bucket/dir/',
    };
    const parsed = decodeAuthToken(base64Of(info));
    expect(parsed.isExpired).toBe(false);
    expect(parsed.expirationStr).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('已过期授权码标记 isExpired=true', () => {
    const info = {
      id: 'STS.token',
      secret: 's',
      stoken: 'st',
      privilege: 'p',
      expiration: '2000-01-02T03:04:05.000Z',
      osspath: 'oss://bucket/dir/',
    };
    const parsed = decodeAuthToken(base64Of(info));
    expect(parsed.isExpired).toBe(true);
  });
});