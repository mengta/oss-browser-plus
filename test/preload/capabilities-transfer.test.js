import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

const AUTH = { accessKeyId: 'ak', accessKeySecret: 'sk' };

let electron;
let transfer;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
  transfer = loadPreload('capabilities/transfer.js');
});

describe('preload capabilities/transfer 任务通道', () => {
  it('createUpload / createDownload 要求完整 auth', async () => {
    expect(() => transfer.createUpload({ accessKeyId: 'ak' }, {})).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => transfer.createDownload(null, {})).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { taskId: 'up-1' } });
    await expect(transfer.createUpload(AUTH, { bucket: 'b' })).resolves.toEqual({ taskId: 'up-1' });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('transfer:createUpload', AUTH, [
      { bucket: 'b' },
    ]);
  });

  it('createDownload 透传保存路径选项', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { taskId: 'down-1' } });

    await expect(transfer.createDownload(AUTH, { bucket: 'b', savePath: 'C:/tmp' })).resolves.toEqual({
      taskId: 'down-1',
    });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('transfer:createDownload', AUTH, [
      { bucket: 'b', savePath: 'C:/tmp' },
    ]);
  });

  it.each([
    ['pause', 'transfer:pause'],
    ['resume', 'transfer:resume'],
    ['cancel', 'transfer:cancel'],
    ['clear', 'transfer:clear'],
    ['retry', 'transfer:retry'],
    ['errorDetail', 'transfer:errorDetail'],
  ])('%s 使用对应通道并传入 taskId', async (method, channel) => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: 'ok' });

    await expect(transfer[method]('task-1')).resolves.toBe('ok');
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(channel, null, ['task-1']);
  });

  it('getTasks / clearFailed 不带业务参数', async () => {
    electron.ipcRenderer.invoke.mockResolvedValue({ ok: true, data: [] });

    await expect(transfer.getTasks()).resolves.toEqual([]);
    await expect(transfer.clearFailed()).resolves.toEqual([]);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('transfer:getTasks', null, []);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('transfer:clearFailed', null, []);
  });

  it('主进程返回错误信封时抛出带 code 的错误', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'NOT_FOUND',
      message: 'task missing',
    });

    await expect(transfer.pause('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'task missing',
    });
  });
});

describe('preload capabilities/transfer 目录能力', () => {
  it('scanFolder 要求非空字符串路径', async () => {
    expect(() => transfer.scanFolder('')).toThrowError(expect.objectContaining({ code: 'INVALID_ARG' }));
    expect(() => transfer.scanFolder(12)).toThrowError(expect.objectContaining({ code: 'INVALID_ARG' }));

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: [{ path: 'C:/a' }] });
    await expect(transfer.scanFolder('C:/a')).resolves.toEqual([{ path: 'C:/a' }]);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('transfer:scanFolder', null, ['C:/a']);
  });

  it('ensureDirs 要求数组入参', async () => {
    expect(() => transfer.ensureDirs('C:/a')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { created: ['C:/a'] } });
    await expect(transfer.ensureDirs(['C:/a'])).resolves.toEqual({ created: ['C:/a'] });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('transfer:ensureDirs', null, [
      ['C:/a'],
    ]);
  });
});

describe('preload capabilities/transfer 进度订阅', () => {
  it('subscribe 注册 progress 监听并转发 payload', () => {
    const callback = vi.fn();
    const id = transfer.subscribe(callback);

    expect(id).toMatch(/^sub-\d+$/);
    expect(electron.ipcRenderer.on).toHaveBeenCalledWith('transfer:progress', expect.any(Function));

    const handler = electron.ipcRenderer.on.mock.calls[0][1];
    handler({}, { taskId: 't1', percent: 42 });
    expect(callback).toHaveBeenCalledWith({ taskId: 't1', percent: 42 });
  });

  it('subscribe 拒绝非函数回调', () => {
    expect(() => transfer.subscribe('cb')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('unsubscribe 移除监听，未知 id 直接返回 true', () => {
    const id = transfer.subscribe(vi.fn());
    const handler = electron.ipcRenderer.on.mock.calls[0][1];

    expect(transfer.unsubscribe(id)).toBe(true);
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith('transfer:progress', handler);
    expect(transfer.unsubscribe(id)).toBe(true);
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledTimes(1);
  });
});