import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stsClient } from '@renderer/services/sts-client.js';
import * as SecureStore from '@renderer/services/secure-store.js';

const ok = (data) => ({ ok: true, data });
const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

let errorSpy;

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  globalThis.__testSafeStorage = false;
  globalThis.__testGcmFail = false;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  localStorage.clear();
  delete globalThis.__testSafeStorage;
  delete globalThis.__testGcmFail;
  errorSpy.mockRestore();
});

describe('sts-client.assumeRole', () => {
  it('桥接缺失时拒绝并提示不可用', async () => {
    delete window.ossBrowser.sts;

    await expect(stsClient.assumeRole('role', 'policy', 900)).rejects.toThrow(
      'sts.assumeRole is unavailable'
    );
  });

  it('注入当前登录 auth 并解包 data', async () => {
    localStorage.setItem('auth-info', JSON.stringify({ accessKeyId: 'ak', accessKeySecret: 'sk' }));
    const assumeRole = vi.fn().mockResolvedValue(ok({ credentials: { accessKeyId: 'sts-ak' } }));
    window.ossBrowser.sts = { assumeRole };

    const result = await stsClient.assumeRole('acs:ram::1:role/r', 'policy', 3600);

    expect(result).toEqual({ credentials: { accessKeyId: 'sts-ak' } });
    expect(assumeRole).toHaveBeenCalledWith(
      { accessKeyId: 'ak', accessKeySecret: 'sk' },
      'acs:ram::1:role/r',
      'policy',
      3600
    );
  });

  it('无登录信息、非法 JSON 或数组 auth 时注入空对象', async () => {
    const assumeRole = vi.fn().mockResolvedValue(ok({ credentials: {} }));
    window.ossBrowser.sts = { assumeRole };

    await stsClient.assumeRole('role', 'policy', 900);
    expect(assumeRole.mock.calls[0][0]).toEqual({});

    localStorage.setItem('auth-info', '{not-json');
    await stsClient.assumeRole('role', 'policy', 900);
    expect(assumeRole.mock.calls[1][0]).toEqual({});

    localStorage.setItem('auth-info', '["not-an-auth"]');
    await stsClient.assumeRole('role', 'policy', 900);
    expect(assumeRole.mock.calls[2][0]).toEqual({});
  });

  it('错误信封转成异常并保留 code/requestId', async () => {
    window.ossBrowser.sts = {
      assumeRole: vi.fn().mockResolvedValue(fail('STS_ERROR', 'Role not found', { requestId: 'r-1' })),
    };

    const err = await stsClient.assumeRole('role').catch((e) => e);

    expect(err.message).toBe('Role not found');
    expect(err.code).toBe('STS_ERROR');
    expect(err.requestId).toBe('r-1');
    expect(errorSpy).toHaveBeenCalledWith('STS_ERROR: Role not found');
  });

  it('InvalidAccessKeyId 时跳转登录页', async () => {
    window.ossBrowser.sts = {
      assumeRole: vi.fn().mockResolvedValue(fail('InvalidAccessKeyId', 'bad ak')),
    };
    window.location.hash = '#/files';

    await expect(stsClient.assumeRole('role')).rejects.toMatchObject({ code: 'InvalidAccessKeyId' });

    expect(window.location.hash).toBe('#!/login');
  });

  it('底层 promise 异常原样抛出并记录', async () => {
    const err = Object.assign(new Error('network'), { code: 'NETWORK' });
    window.ossBrowser.sts = { assumeRole: vi.fn().mockRejectedValue(err) };

    await expect(stsClient.assumeRole('role')).rejects.toBe(err);
    expect(errorSpy).toHaveBeenCalledWith('NETWORK: network');
  });

  it('非信封返回值直接透传', async () => {
    window.ossBrowser.sts = { assumeRole: vi.fn().mockResolvedValue({ Credentials: {} }) };

    await expect(stsClient.assumeRole('role')).resolves.toEqual({ Credentials: {} });
  });
});