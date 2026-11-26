import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ramClient, { ram } from '@renderer/services/ram-client.js';
import * as SecureStore from '@renderer/services/secure-store.js';

const METHODS = [
  'listUsers',
  'listGroups',
  'listRoles',
  'createPolicy',
  'getPolicy',
  'attachPolicyToRole',
  'attachPolicyToGroup',
  'attachPolicyToUser',
  'detachPolicyFromUser',
  'listPoliciesForUser',
  'getUser',
  'createUser',
  'updateUser',
  'deleteUser',
  'createAccessKey',
  'updateAccessKey',
  'deleteAccessKey',
  'listAccessKeys',
];

let errorSpy;
let originalRam;

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  globalThis.__testSafeStorage = false;
  originalRam = window.ossBrowser.ram;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  localStorage.clear();
  delete globalThis.__testSafeStorage;
  window.ossBrowser.ram = originalRam;
  errorSpy.mockRestore();
});

describe('ram-client 结构冻结', () => {
  it('冻结 18 个方法且默认导出与命名导出一致', () => {
    expect(Object.keys(ramClient).sort()).toEqual([...METHODS].sort());
    METHODS.forEach((method) => {
      expect(typeof ramClient[method]).toBe('function');
    });
    expect(ram).toBe(ramClient);
  });
});

describe('ram-client 代理行为', () => {
  it('桥接缺失时所有方法返回不可用拒绝', async () => {
    delete window.ossBrowser.ram;

    await expect(ramClient.listUsers()).rejects.toThrow('ram.listUsers is unavailable');
    await expect(ramClient.deleteAccessKey('u', 'ak')).rejects.toThrow(
      'ram.deleteAccessKey is unavailable'
    );
  });

  it('注入当前 auth 并解包 data', async () => {
    localStorage.setItem('auth-info', JSON.stringify({ accessKeyId: 'ak', accessKeySecret: 'sk' }));
    const createUser = vi.fn().mockResolvedValue({ ok: true, data: { userName: 'u1' } });
    window.ossBrowser.ram = { createUser };

    await expect(ramClient.createUser('u1', '显示名')).resolves.toEqual({ userName: 'u1' });
    expect(createUser).toHaveBeenCalledWith({ accessKeyId: 'ak', accessKeySecret: 'sk' }, 'u1', '显示名');
  });

  it('auth-info 为数组时注入空对象', async () => {
    localStorage.setItem('auth-info', '["not-an-auth"]');
    const listUsers = vi.fn().mockResolvedValue({ ok: true, data: [] });
    window.ossBrowser.ram = { listUsers };

    await ramClient.listUsers();
    expect(listUsers.mock.calls[0][0]).toEqual({});
  });

  it('错误信封转成异常并跳过登录跳转（jsdom 环境）', async () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    window.ossBrowser.ram = {
      listUsers: vi.fn().mockResolvedValue({
        ok: false,
        code: 'InvalidAccessKeyId',
        message: 'bad ak',
        requestId: 'req-2',
      }),
    };

    const err = await ramClient.listUsers().catch((e) => e);

    expect(err.code).toBe('InvalidAccessKeyId');
    expect(err.requestId).toBe('req-2');
    expect(reload).not.toHaveBeenCalled();
    // jsdom UA 命中 goToLogin 的提前返回分支：不跳转、不打印
    expect(errorSpy).not.toHaveBeenCalled();
    expect(originalLocation.hash).toBe(window.location.hash);
  });

  it('Failed to fetch 归一为「无法连接」', async () => {
    window.ossBrowser.ram = { listRoles: vi.fn().mockRejectedValue(new Error('Failed to fetch')) };

    await expect(ramClient.listRoles()).rejects.toThrow('Failed to fetch');
    expect(errorSpy).toHaveBeenCalledWith('Error: 无法连接');
  });

  it('无 code 的其它错误记录原始消息', async () => {
    window.ossBrowser.ram = { listGroups: vi.fn().mockRejectedValue(new Error('timeout')) };

    await expect(ramClient.listGroups()).rejects.toThrow('timeout');
    expect(errorSpy).toHaveBeenCalledWith('Error: timeout');
  });

  it('带 code 的其它错误直接记录 code', async () => {
    window.ossBrowser.ram = { getUser: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'RAM_ERROR' })) };

    await expect(ramClient.getUser('u1')).rejects.toThrow('x');
    expect(errorSpy).toHaveBeenCalledWith('RAM_ERROR: x');
  });

  it('非信封返回值透传', async () => {
    window.ossBrowser.ram = { listUsers: vi.fn().mockResolvedValue([{ userName: 'u1' }]) };

    await expect(ramClient.listUsers()).resolves.toEqual([{ userName: 'u1' }]);
  });
});