import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire('module');

const DOMAINS = [
  'bootstrap',
  'system',
  'credentials',
  'digest',
  'storage',
  'oss',
  'sts',
  'ram',
  'mail',
  'transfer',
  'upgrade',
];

let electron;
let bridge;
let exposedApi;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
  loadPreload('net-bridge.js');
  expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);
  exposedApi = electron.contextBridge.exposeInMainWorld.mock.calls[0][1];
});

function stubModuleRequire(handler) {
  const originalRequire = Module.prototype.require;
  const spy = vi.spyOn(Module.prototype, 'require').mockImplementation(function (request, ...rest) {
    const result = handler.call(this, request);
    if (result !== undefined) return result;
    return originalRequire.call(this, request, ...rest);
  });
  return spy;
}

describe('preload net-bridge 正常装配', () => {
  it('向渲染世界暴露 ossBrowser，包含全部 11 个域', () => {
    expect(electron.contextBridge.exposeInMainWorld.mock.calls[0][0]).toBe('ossBrowser');
    expect(Object.keys(exposedApi).sort()).toEqual([...DOMAINS].sort());
    expect(typeof exposedApi.oss.deleteFiles).toBe('function');
    expect(typeof exposedApi.credentials.protect).toBe('function');
  });

  it('manifest 标记 sync 的方法同步返回 ok 信封', () => {
    const result = exposedApi.bootstrap.get();

    expect(result.ok).toBe(true);
    expect(result.data.appId).toBe('oss-browser');
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('异步方法把返回值包成 ok:true/data', async () => {
    electron.ipcRenderer.invoke.mockImplementation((channel) => {
      if (channel === 'app:get-static-server-port') return Promise.resolve(7124);
      return Promise.resolve({ ok: true, data: { channel } });
    });

    await expect(exposedApi.system.getStaticServerPort()).resolves.toEqual({
      ok: true,
      data: 7124,
    });
    await expect(exposedApi.oss.listAllBuckets({ accessKeyId: 'ak' })).resolves.toEqual({
      ok: true,
      data: { channel: 'oss:listAllBuckets' },
    });
  });

  it('同步方法抛出的参数错误被转换为 ok:false 信封', () => {
    expect(exposedApi.system.pathJoin('not-array')).toEqual({
      ok: false,
      code: 'INVALID_ARG',
      message: 'parts must be an array',
    });
  });

  it('异步实现抛错同样转换为错误信封', async () => {
    await expect(exposedApi.system.openExternal('file:///C:/x')).resolves.toEqual({
      ok: false,
      code: 'INVALID_ARG',
      message: 'only http(s) urls are allowed',
    });
  });

  it('错误信封保留 requestId/ecCode/hostId/statusCode 诊断字段', async () => {
    const err = new Error('AccessDenied');
    err.code = 'OSS_ERROR';
    err.requestId = 'req-1';
    err.ecCode = 'AccessDenied';
    err.hostId = 'bucket.oss-cn-hangzhou.aliyuncs.com';
    err.statusCode = 403;
    electron.ipcRenderer.invoke.mockRejectedValueOnce(err);

    await expect(exposedApi.oss.listFiles({ accessKeyId: 'ak' }, { bucket: 'b' })).resolves.toEqual({
      ok: false,
      code: 'OSS_ERROR',
      message: 'AccessDenied',
      requestId: 'req-1',
      ecCode: 'AccessDenied',
      hostId: 'bucket.oss-cn-hangzhou.aliyuncs.com',
      statusCode: 403,
    });
  });

  it('manifest 已登记但实现缺失的方法返回 UNAVAILABLE', async () => {
    const spy = stubModuleRequire(function (request) {
      if (request === './capabilities/transfer') return { pause() {} };
      return undefined;
    });

    try {
      electron.contextBridge.exposeInMainWorld.mockClear();
      loadPreload('net-bridge.js');
      const api = electron.contextBridge.exposeInMainWorld.mock.calls[0][1];

      expect(await api.transfer.getTasks()).toEqual({
        ok: false,
        code: 'UNAVAILABLE',
        message: 'transfer.getTasks is unavailable',
      });
      // manifest 中存在但在实现里缺失的方法同样降级为 UNAVAILABLE
      await expect(api.transfer.subscribe()).resolves.toMatchObject({ code: 'UNAVAILABLE' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('preload net-bridge 降级装配', () => {
  it('manifest 缺失时全部域降级为异步 UNAVAILABLE', async () => {
    const spy = stubModuleRequire(function (request) {
      if (request === './api-manifest' && /net-bridge\.js$/.test(this.filename || '')) {
        throw new Error('manifest missing');
      }
      return undefined;
    });

    try {
      electron.contextBridge.exposeInMainWorld.mockClear();
      loadPreload('net-bridge.js');
      const api = electron.contextBridge.exposeInMainWorld.mock.calls[0][1];

      expect(Object.keys(api).sort()).toEqual([...DOMAINS].sort());
      expect(await api.bootstrap.get()).toEqual({
        ok: false,
        code: 'UNAVAILABLE',
        message: 'bootstrap.get is unavailable',
      });
      expect(await api.system.getStaticServerPort()).toEqual({
        ok: false,
        code: 'UNAVAILABLE',
        message: 'system.getStaticServerPort is unavailable',
      });
      // 无 manifest 时使用最小回退方法集
      expect(await api.system.openExternal('https://x.test')).toMatchObject({
        code: 'UNAVAILABLE',
      });
      expect(api.system.openDevTools).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('单个能力实现加载失败时该域降级，其他域保持可用', async () => {
    const spy = stubModuleRequire(function (request) {
      if (request === './capabilities/oss') throw new Error('capability broken');
      return undefined;
    });

    try {
      electron.contextBridge.exposeInMainWorld.mockClear();
      loadPreload('net-bridge.js');
      const api = electron.contextBridge.exposeInMainWorld.mock.calls[0][1];

      expect(await api.oss.listAllBuckets({ accessKeyId: 'ak' })).toEqual({
        ok: false,
        code: 'UNAVAILABLE',
        message: 'oss.listAllBuckets is unavailable',
      });
      expect(api.bootstrap.get().ok).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});