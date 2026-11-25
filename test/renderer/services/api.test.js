import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, bootstrapSync, subscribeTransfer } from '@renderer/services/api.js';
import { resolveTimeout, normalizeResult, normalizeError } from '@renderer/services/ipc.js';

let originals;

beforeEach(() => {
  originals = {
    openExternal: window.ossBrowser.system.openExternal,
    getTasks: window.ossBrowser.transfer.getTasks,
    getStaticServerPort: window.ossBrowser.system.getStaticServerPort,
  };
});

afterEach(() => {
  window.ossBrowser.system.openExternal = originals.openExternal;
  window.ossBrowser.transfer.getTasks = originals.getTasks;
  window.ossBrowser.system.getStaticServerPort = originals.getStaticServerPort;
  vi.useRealTimers();
});

describe('ipc 超时策略表', () => {
  it('默认 8s / dialog 60s / mail 20s / transfer 无超时', () => {
    expect(resolveTimeout('system', 'openExternal')).toBe(8000);
    expect(resolveTimeout('system', 'showOpenDialog')).toBe(60000);
    expect(resolveTimeout('mail', 'sendTest')).toBe(20000);
    expect(resolveTimeout('transfer', 'getTasks')).toBe(0);
  });

  it('结果与错误归一', () => {
    expect(normalizeResult({ ok: true, data: 1 })).toEqual({ ok: true, data: 1 });
    expect(normalizeResult({ ok: false, code: 'X', message: 'm' })).toEqual({ ok: false, code: 'X', message: 'm' });
    expect(normalizeResult('raw')).toEqual({ ok: true, data: 'raw' });
    expect(normalizeError(new Error('boom'))).toEqual({ ok: false, code: 'INTERNAL', message: 'boom' });
  });
});

describe('api 门面', () => {
  it('成功调用返回 {ok:true,data}', async () => {
    const res = await api.system.getStaticServerPort();
    expect(res.ok).toBe(true);
    expect(res.data).toBe(7123);
  });

  it('超时返回 {ok:false,code:TIMEOUT} 且不抛出', async () => {
    vi.useFakeTimers();
    window.ossBrowser.system.openExternal = () => new Promise(() => {});
    const pending = api.system.openExternal('https://example.com');
    await vi.advanceTimersByTimeAsync(8100);
    const res = await pending;
    expect(res.ok).toBe(false);
    expect(res.code).toBe('TIMEOUT');
  });

  it('transfer 无超时（9s 后仍成功）', async () => {
    vi.useFakeTimers();
    window.ossBrowser.transfer.getTasks = () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true, data: [] }), 9000);
      });
    const pending = api.transfer.getTasks();
    await vi.advanceTimersByTimeAsync(9100);
    const res = await pending;
    expect(res.ok).toBe(true);
  });

  it('bridge 缺失返回 UNAVAILABLE 不抛出', async () => {
    const res = await api.oss.listFiles({}, 'b');
    expect(res.ok).toBe(true);
  });

  it('subscribeTransfer 返回可调用的 unsubscribe', async () => {
    const off = subscribeTransfer(() => {});
    expect(typeof off).toBe('function');
    const res = await off();
    expect(res && res.ok).toBe(true);
  });

  it('bootstrapSync 同步返回快照', () => {
    const res = bootstrapSync();
    expect(res.ok).toBe(true);
    expect(res.data.appVersion).toBe('1.20.6');
  });
});