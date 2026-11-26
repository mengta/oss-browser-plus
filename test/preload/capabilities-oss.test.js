import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

const AUTH = { accessKeyId: 'ak', accessKeySecret: 'sk' };

let electron;
let oss;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
  oss = loadPreload('capabilities/oss.js');
});

describe('preload capabilities/oss 白名单代理', () => {
  it('普通方法解包 ok 信封并透传 auth 与参数', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: [{ name: 'b1' }] });

    await expect(oss.listAllBuckets(AUTH)).resolves.toEqual([{ name: 'b1' }]);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('oss:listAllBuckets', AUTH, []);
  });

  it('对象权限类方法把参数打包进第二个 IPC 实参', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: 'private' });

    await expect(oss.getACL(AUTH, 'bucket-a', 'key-a')).resolves.toBe('private');
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('oss:getACL', AUTH, [
      'bucket-a',
      'key-a',
    ]);
  });

  it('manifest expose=false 的内部方法不暴露给渲染层', () => {
    expect(oss.getClient).toBeUndefined();
    expect(oss.getClient2).toBeUndefined();
    expect(oss.getClient3).toBeUndefined();
    expect(oss.parseOSSPath).toBeUndefined();
    expect(oss.parseRestoreInfo).toBeUndefined();
    expect(typeof oss.probeUrl).toBe('function');
  });

  it('主进程错误信封转为带 code 的异常', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'OSS_ERROR',
      message: 'AccessDenied',
      requestId: 'req-9',
    });

    await expect(oss.listFiles(AUTH, { bucket: 'b' })).rejects.toMatchObject({
      code: 'OSS_ERROR',
      message: 'AccessDenied',
      requestId: 'req-9',
    });
  });
});

describe('preload capabilities/oss 批量进度流', () => {
  it('deleteFiles 生成 progressId、转发匹配进度并在完成后解绑', async () => {
    const progress = vi.fn();
    let resolveReply;
    electron.ipcRenderer.invoke.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReply = resolve;
      })
    );

    const pending = oss.deleteFiles(AUTH, 'cn-hangzhou', 'bucket-a', ['a.txt'], progress);

    expect(electron.ipcRenderer.on).toHaveBeenCalledWith('oss:progress', expect.any(Function));
    const handler = electron.ipcRenderer.on.mock.calls[0][1];
    const channelArgs = electron.ipcRenderer.invoke.mock.calls[0];
    expect(channelArgs[0]).toBe('oss:deleteFiles');
    expect(channelArgs[1]).toBe(AUTH);
    expect(channelArgs[2].slice(0, 3)).toEqual(['cn-hangzhou', 'bucket-a', ['a.txt']]);
    const progressId = channelArgs[2][3].progressId;
    expect(progressId).toMatch(/^ossop-\d+-\d+$/);

    handler({}, { progressId: 'other-id', progress: { current: 99 } });
    expect(progress).not.toHaveBeenCalled();

    handler({}, { progressId, progress: { current: 1, total: 2 } });
    expect(progress).toHaveBeenCalledWith({ current: 1, total: 2 });

    resolveReply({ ok: true, data: { deleted: 1 } });
    await expect(pending).resolves.toEqual({ deleted: 1 });
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith('oss:progress', handler);
  });

  it('deleteFiles 失败时同样解绑监听并抛出错误', async () => {
    electron.ipcRenderer.invoke.mockRejectedValueOnce(new Error('IPC closed'));

    await expect(oss.deleteFiles(AUTH, 'r', 'b', [], vi.fn())).rejects.toThrow('IPC closed');
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith(
      'oss:progress',
      expect.any(Function)
    );
  });

  it('copyFiles 按既定顺序封装 region/items/target/开关/重命名与 progressId', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { copied: 2 } });

    await expect(
      oss.copyFiles(AUTH, 'cn-hangzhou', ['a', 'b'], 'dst/', vi.fn(), true, 'rename-rule')
    ).resolves.toEqual({ copied: 2 });

    const [channel, payloadAuth, args] = electron.ipcRenderer.invoke.mock.calls[0];
    expect(channel).toBe('oss:copyFiles');
    expect(payloadAuth).toBe(AUTH);
    expect(args.slice(0, 5)).toEqual(['cn-hangzhou', ['a', 'b'], 'dst/', true, 'rename-rule']);
    expect(args[5].progressId).toMatch(/^ossop-/);
  });

  it('回调缺失时进度事件不报错', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: null });

    const pending = oss.deleteFiles(AUTH, 'r', 'b', []);
    const handler = electron.ipcRenderer.on.mock.calls[0][1];
    const progressId = electron.ipcRenderer.invoke.mock.calls[0][2][3].progressId;

    expect(() => handler({}, { progressId, progress: { current: 1 } })).not.toThrow();
    await expect(pending).resolves.toBeNull();
  });
});

describe('preload capabilities/oss probeUrl', () => {
  it('默认使用空选项并走 app:probe-url 通道', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { status: 200 } });

    await expect(oss.probeUrl('https://bucket.oss-cn-hangzhou.aliyuncs.com')).resolves.toEqual({
      status: 200,
    });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      'app:probe-url',
      'https://bucket.oss-cn-hangzhou.aliyuncs.com',
      {}
    );
  });

  it('透传自定义选项', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { status: 404 } });

    await oss.probeUrl('https://x.test', { timeoutMs: 800 });

    expect(electron.ipcRenderer.invoke.mock.calls[0][2]).toEqual({ timeoutMs: 800 });
  });
});