import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

let electron;
let shared;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
  shared = loadPreload('capabilities/shared.js');
});

describe('preload shared.invokeChannel', () => {
  it('resolves data when the main process replies with an ok envelope', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { buckets: ['b1'] } });

    const result = await shared.invokeChannel('oss:listAllBuckets', [{ ak: 'a' }], 1000);

    expect(result).toEqual({ buckets: ['b1'] });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('oss:listAllBuckets', { ak: 'a' });
  });

  it('resolves the raw reply when it is not an ok envelope', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce('plain-value');

    await expect(shared.invokeChannel('app:plain', [], 1000)).resolves.toBe('plain-value');
  });

  it('rejects with the error envelope code and metadata', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'OSS_ERROR',
      message: 'AccessDenied',
      requestId: 'req-1',
      ecCode: 'AccessDenied',
      failures: [{ key: 'a' }],
    });

    const err = await shared.invokeChannel('oss:deleteFiles', [], 1000).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('AccessDenied');
    expect(err.code).toBe('OSS_ERROR');
    expect(err.requestId).toBe('req-1');
    expect(err.ecCode).toBe('AccessDenied');
    expect(err.failures).toEqual([{ key: 'a' }]);
  });

  it('falls back to the channel name and INTERNAL code for an incomplete error envelope', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: false });

    const err = await shared.invokeChannel('transfer:pause', [], 1000).catch((e) => e);

    expect(err.message).toBe('transfer:pause failed');
    expect(err.code).toBe('INTERNAL');
    expect(err.requestId).toBeUndefined();
  });

  it('rejects synchronously when invoke throws', async () => {
    electron.ipcRenderer.invoke.mockImplementationOnce(() => {
      throw new Error('ipc broken');
    });

    await expect(shared.invokeChannel('oss:listFiles', [], 1000)).rejects.toThrow('ipc broken');
  });

  it('rejects when the invoke promise rejects', async () => {
    electron.ipcRenderer.invoke.mockRejectedValueOnce(new Error('channel closed'));

    await expect(shared.invokeChannel('oss:listFiles', [], 1000)).rejects.toThrow('channel closed');
  });

  it('rejects with TIMEOUT when the reply exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    electron.ipcRenderer.invoke.mockReturnValueOnce(new Promise(() => {}));

    const pending = shared.invokeChannel('oss:slow', [], 50);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT', message: 'oss:slow timed out' });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    vi.useRealTimers();
  });

  it('never times out when timeoutMs is 0', async () => {
    vi.useFakeTimers();
    let resolveReply;
    electron.ipcRenderer.invoke.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReply = resolve;
      })
    );

    const pending = shared.invokeChannel('oss:deleteFiles', [], 0);
    await vi.advanceTimersByTimeAsync(120000);
    resolveReply({ ok: true, data: 'done' });

    await expect(pending).resolves.toBe('done');
    vi.useRealTimers();
  });

  it('ignores a late reply after the timeout already settled', async () => {
    vi.useFakeTimers();
    let resolveReply;
    electron.ipcRenderer.invoke.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReply = resolve;
      })
    );

    const pending = shared.invokeChannel('oss:slow', [], 10);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    resolveReply({ ok: true, data: 'late' });
    vi.useRealTimers();
  });
});

describe('preload shared.buildDomainApi', () => {
  it('creates one method per exposed manifest entry and forwards the channel payload', async () => {
    electron.ipcRenderer.invoke.mockResolvedValue({ ok: true, data: { done: true } });
    const api = shared.buildDomainApi('ram', 45000);

    expect(typeof api.listUsers).toBe('function');
    expect(api.getClient).toBeUndefined();
    expect(api.parseOSSPath).toBeUndefined();

    await api.listUsers({ accessKeyId: 'ak' }, { userName: 'u1' });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('ram:listUsers', { accessKeyId: 'ak' }, [
      { userName: 'u1' },
    ]);
  });

  it('returns an empty api for an unknown domain', () => {
    expect(shared.buildDomainApi('not-a-domain', 1000)).toEqual({});
  });
});