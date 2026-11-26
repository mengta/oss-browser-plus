import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

const nodeRequire = createRequire(import.meta.url);
const fs = nodeRequire('fs');

let electron;
let system;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
  system = loadPreload('capabilities/system.js');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('preload capabilities/system 应用通道', () => {
  it('getStaticServerPort 返回数值端口，非数值视为未就绪', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce(7123);
    await expect(system.getStaticServerPort()).resolves.toBe(7123);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('app:get-static-server-port');

    electron.ipcRenderer.invoke.mockResolvedValueOnce('7123');
    await expect(system.getStaticServerPort()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('主进程无响应时按超时拒绝', async () => {
    vi.useFakeTimers();
    electron.ipcRenderer.invoke.mockReturnValueOnce(new Promise(() => {}));

    const pending = system.getStaticServerPort();
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: 'app:get-static-server-port timed out',
    });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    vi.useRealTimers();
  });

  it('openDevTools / refreshPage 成功后返回 true', async () => {
    electron.ipcRenderer.invoke.mockResolvedValue(undefined);

    await expect(system.openDevTools()).resolves.toBe(true);
    await expect(system.refreshPage()).resolves.toBe(true);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('app:open-dev-tools');
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('app:refresh-page');
  });

  it('installAndRestart 校验版本号并把失败信封转成错误', async () => {
    await expect(system.installAndRestart('1.2')).rejects.toMatchObject({ code: 'INVALID_ARG' });

    electron.ipcRenderer.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'IO',
      message: 'package missing',
    });
    await expect(system.installAndRestart('1.2.3')).rejects.toMatchObject({
      code: 'IO',
      message: 'package missing',
    });

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true });
    await expect(system.installAndRestart('1.2.3')).resolves.toBe(true);
  });

  it('showOpenDialog 规范化属性并提供取消兜底', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ canceled: true, filePaths: ['C:/a.txt'] });
    await expect(system.showOpenDialog({ properties: ['openFile', 'bogus'] })).resolves.toEqual({
      canceled: true,
      filePaths: ['C:/a.txt'],
    });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('dialog:show-open-dialog', {
      properties: ['openFile'],
    });

    electron.ipcRenderer.invoke.mockResolvedValueOnce(null);
    await expect(system.showOpenDialog(undefined)).resolves.toEqual({ canceled: true, filePaths: [] });

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ canceled: false, filePaths: 'bad' });
    await expect(system.showOpenDialog({ properties: [] })).resolves.toEqual({
      canceled: false,
      filePaths: [],
    });
  });

  it('showOpenDialog 拒绝非法 defaultPath 与非字符串属性', async () => {
    await expect(system.showOpenDialog({ defaultPath: 12 })).rejects.toMatchObject({
      code: 'INVALID_ARG',
    });
  });

  it('openExternal 只允许 http(s) 链接', async () => {
    await expect(system.openExternal('')).rejects.toMatchObject({ code: 'INVALID_ARG' });
    await expect(system.openExternal('not a url')).rejects.toMatchObject({ code: 'INVALID_ARG' });
    await expect(system.openExternal('file:///C:/x')).rejects.toMatchObject({ code: 'INVALID_ARG' });

    await expect(system.openExternal('https://help.aliyun.com')).resolves.toBe(true);
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://help.aliyun.com');
  });

  it('showItemInFolder 要求绝对路径', async () => {
    await expect(system.showItemInFolder('relative/file.txt')).rejects.toMatchObject({
      code: 'INVALID_ARG',
    });

    const absolute = path.resolve('downloaded.txt');
    await expect(system.showItemInFolder(absolute)).resolves.toBe(true);
    expect(electron.shell.showItemInFolder).toHaveBeenCalledWith(absolute);
  });

  it('剪贴板读写走 IPC，写入要求字符串', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce('copied');
    await expect(system.clipboardReadText()).resolves.toBe('copied');

    electron.ipcRenderer.invoke.mockResolvedValueOnce(undefined);
    await expect(system.clipboardWriteText('text')).resolves.toBe(true);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('clipboard:write-text', 'text');

    await expect(system.clipboardWriteText(null)).rejects.toMatchObject({ code: 'INVALID_ARG' });
  });
});

describe('preload capabilities/system 发布说明', () => {
  it('按 lang → 无 lang 顺序查找，命中即返回内容', async () => {
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      const err = new Error('missing');
      err.code = 'ENOENT';
      throw err;
    });

    readSpy.mockImplementationOnce(() => {
      const err = new Error('missing');
      err.code = 'ENOENT';
      throw err;
    });
    readSpy.mockReturnValueOnce('# 1.2.3 更新说明');

    const result = await system.readReleaseNotes('1.2.3', 'zh-CN');

    expect(result).toEqual({ found: true, markdown: '# 1.2.3 更新说明' });
    expect(readSpy.mock.calls[0][0]).toContain('1.2.3.zh-CN.md');
    expect(readSpy.mock.calls[1][0]).toContain('1.2.3.md');
  });

  it('非法语言不拼接语言后缀，全部缺失时返回 found=false', async () => {
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      const err = new Error('missing');
      err.code = 'ENOENT';
      throw err;
    });

    const result = await system.readReleaseNotes('1.2.3', 'xx-XX');

    expect(result).toEqual({ found: false, markdown: '' });
    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(readSpy.mock.calls[0][0]).toContain('1.2.3.md');
  });

  it('非 ENOENT 读取失败抛 IO，非法版本抛 INVALID_ARG', async () => {
    const denied = new Error('denied');
    denied.code = 'EACCES';
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw denied;
    });

    await expect(system.readReleaseNotes('1.2.3')).rejects.toMatchObject({ code: 'IO' });
    await expect(system.readReleaseNotes('v1')).rejects.toMatchObject({ code: 'INVALID_ARG' });
  });
});

describe('preload capabilities/system 内网探测', () => {
  it('缺少模板参数时抛 INVALID_ARG', async () => {
    await expect(system.detectInternalEndpoint({})).rejects.toMatchObject({ code: 'INVALID_ARG' });
  });

  it('HEAD 探测成功时返回 internalSupported=true，并自动补 https', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(system.detectInternalEndpoint({ eptpl: 'oss-internal.example.com' })).resolves.toEqual({
      internalSupported: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oss-internal.example.com',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
    );
  });

  it('探测异常时返回 internalSupported=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));

    await expect(system.detectInternalEndpoint({ eptpl: 'http://10.0.0.1' })).resolves.toEqual({
      internalSupported: false,
    });
  });
});

describe('preload capabilities/system 路径与拖拽', () => {
  it('路径纯计算与 node:path 一致', () => {
    expect(system.pathDirname('C:/a/b.txt')).toBe(path.dirname('C:/a/b.txt'));
    expect(system.pathBasename('C:/a/b.txt')).toBe('b.txt');
    expect(system.pathJoin(['a', 'b', 'c.txt'])).toBe(path.join('a', 'b', 'c.txt'));
    expect(system.pathRelative('/a', '/a/b/c')).toBe(path.relative('/a', '/a/b/c'));
  });

  it('路径参数类型错误抛 INVALID_ARG', () => {
    expect(() => system.pathDirname(1)).toThrowError(expect.objectContaining({ code: 'INVALID_ARG' }));
    expect(() => system.pathBasename(null)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => system.pathJoin('a/b')).toThrowError(expect.objectContaining({ code: 'INVALID_ARG' }));
    expect(() => system.pathRelative('a')).toThrowError(expect.objectContaining({ code: 'INVALID_ARG' }));
  });

  it('getPathForFile 通过 webUtils 解析拖拽文件', () => {
    expect(system.getPathForFile({ name: 'a.txt' })).toBe('C:/tmp/sample.txt');
    expect(electron.webUtils.getPathForFile).toHaveBeenCalledWith({ name: 'a.txt' });
    expect(() => system.getPathForFile(null)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('getPathForFile 在 webUtils 抛错或缺失时回退空串', () => {
    electron.webUtils.getPathForFile.mockImplementationOnce(() => {
      throw new Error('not an electron File');
    });
    expect(system.getPathForFile({})).toBe('');

    const mock = createElectronMock();
    delete mock.webUtils;
    installElectronMock(mock);
    const reloaded = loadPreload('capabilities/system.js');
    expect(reloaded.getPathForFile({})).toBe('');
  });
});

describe('preload capabilities/system 窗口控制与错误上报', () => {
  it('窗口控制方法返回布尔/true', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce(undefined);
    await expect(system.minimizeWindow()).resolves.toBe(true);

    electron.ipcRenderer.invoke.mockResolvedValueOnce(1);
    await expect(system.toggleMaximizeWindow()).resolves.toBe(true);

    electron.ipcRenderer.invoke.mockResolvedValueOnce(undefined);
    await expect(system.closeWindow()).resolves.toBe(true);

    electron.ipcRenderer.invoke.mockResolvedValueOnce(0);
    await expect(system.isWindowMaximized()).resolves.toBe(false);
  });

  it('窗口最大化状态订阅可回调并解绑', () => {
    const callback = vi.fn();
    const id = system.subscribeWindowState(callback);

    expect(id).toMatch(/^window-\d+$/);
    const handler = electron.ipcRenderer.on.mock.calls[0][1];
    handler({}, 1);
    expect(callback).toHaveBeenCalledWith(true);

    expect(system.unsubscribeWindowState(id)).toBe(true);
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith(
      'window:maximized-changed',
      handler
    );
    expect(system.unsubscribeWindowState('window-unknown')).toBe(true);
  });

  it('窗口状态订阅要求函数回调', () => {
    expect(() => system.subscribeWindowState('cb')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('reportError 发送成功返回 true，发送异常返回 false', () => {
    expect(system.reportError({ kind: 'vue', message: 'boom' })).toBe(true);
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith('app:renderer-error', {
      kind: 'vue',
      message: 'boom',
    });

    electron.ipcRenderer.send.mockImplementationOnce(() => {
      throw new Error('closed');
    });
    expect(system.reportError({ message: 'boom' })).toBe(false);
  });
});