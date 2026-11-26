import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

let electron;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
});

describe('preload capabilities/mail', () => {
  it('validateConfig 接受合法 SMTP 配置', () => {
    const mail = loadPreload('capabilities/mail.js');

    expect(mail.validateConfig({ host: 'smtp.test.com', port: 465, secure: true, user: 'u', pass: 'p' })).toEqual(
      { valid: true, message: '' }
    );
  });

  it('validateConfig 汇总所有非法字段', () => {
    const mail = loadPreload('capabilities/mail.js');

    const result = mail.validateConfig({ host: '', port: 70000, secure: 'yes', user: 1, pass: [] });

    expect(result.valid).toBe(false);
    expect(result.message).toBe(
      'host is required; port is invalid; secure must be boolean; user must be a string; pass must be a string'
    );
  });

  it('validateConfig 缺省参数与字符串端口按非法处理', () => {
    const mail = loadPreload('capabilities/mail.js');

    expect(mail.validateConfig().message).toBe('host is required; port is invalid');
    expect(mail.validateConfig({ host: 'h', port: '465' })).toEqual({
      valid: true,
      message: '',
    });
    expect(mail.validateConfig({ host: 'h', port: 0 }).valid).toBe(false);
  });

  it('sendTest 校验参数并走 mail:sendTest', async () => {
    const mail = loadPreload('capabilities/mail.js');
    const smtp = { host: 'smtp.test.com', port: 465 };

    expect(() => mail.sendTest(null, 'a@b.c')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => mail.sendTest(smtp, '')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: true });
    await expect(mail.sendTest(smtp, 'a@b.c')).resolves.toBe(true);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('mail:sendTest', smtp, 'a@b.c');
  });

  it('send 要求 info.to 并透传附件信息', async () => {
    const mail = loadPreload('capabilities/mail.js');
    const smtp = { host: 'h', port: 465 };
    const info = { to: 'a@b.c', subject: '授权', html: '<b>x</b>' };

    expect(() => mail.send(smtp, {})).toThrowError(expect.objectContaining({ code: 'INVALID_ARG' }));
    expect(() => mail.send('bad', info)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );

    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: true });
    await expect(mail.send(smtp, info)).resolves.toBe(true);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('mail:send', smtp, info);
  });

  it('主进程返回失败信封时抛错', async () => {
    const mail = loadPreload('capabilities/mail.js');
    electron.ipcRenderer.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'SMTP_ERROR',
      message: 'auth failed',
    });

    await expect(mail.sendTest({ host: 'h' }, 'a@b.c')).rejects.toMatchObject({
      code: 'SMTP_ERROR',
      message: 'auth failed',
    });
  });
});

describe('preload capabilities/digest', () => {
  it('sha256Hex 输出标准十六进制摘要', () => {
    const digest = loadPreload('capabilities/digest.js');

    expect(digest.sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(digest.sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('非字符串入参抛 INVALID_ARG', () => {
    const digest = loadPreload('capabilities/digest.js');

    expect(() => digest.sha256Hex(123)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG', message: 'text must be a string' })
    );
  });
});

describe('preload capabilities/upgrade', () => {
  it('check/download/install 使用升级通道', async () => {
    const upgrade = loadPreload('capabilities/upgrade.js');
    electron.ipcRenderer.invoke.mockResolvedValue({ ok: true, data: { hasNew: true } });

    await expect(upgrade.check()).resolves.toEqual({ hasNew: true });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('upgrade:check', null, []);

    await upgrade.download({ version: '1.2.3', url: 'https://x/pkg' });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('upgrade:download', null, [
      { version: '1.2.3', url: 'https://x/pkg' },
    ]);

    await upgrade.install({ version: '1.2.3' });
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('upgrade:install', null, [
      { version: '1.2.3' },
    ]);
  });

  it('subscribe 转发 upgrade:state 并可解绑', () => {
    const upgrade = loadPreload('capabilities/upgrade.js');
    const callback = vi.fn();

    const id = upgrade.subscribe(callback);

    expect(id).toMatch(/^upgrade-sub-\d+$/);
    const handler = electron.ipcRenderer.on.mock.calls[0][1];
    handler({}, { state: 'downloading', info: { percent: 30 } });
    expect(callback).toHaveBeenCalledWith({ state: 'downloading', info: { percent: 30 } });

    expect(upgrade.unsubscribe(id)).toBe(true);
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith('upgrade:state', handler);
    expect(upgrade.unsubscribe(id)).toBe(true);
  });

  it('subscribe 要求函数回调；失败信封转为异常', async () => {
    const upgrade = loadPreload('capabilities/upgrade.js');

    expect(() => upgrade.subscribe(null)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );

    electron.ipcRenderer.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'NETWORK',
      message: 'manifest unreachable',
    });
    await expect(upgrade.check()).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('preload capabilities/sts 与 ram 薄封装', () => {
  it('sts.assumeRole 透传 auth 与策略参数', async () => {
    const sts = loadPreload('capabilities/sts.js');
    electron.ipcRenderer.invoke.mockResolvedValueOnce({ ok: true, data: { credentials: {} } });

    await sts.assumeRole(AUTH(), 'acs:ram::1:role/r', 'policy-json');

    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      'sts:assumeRole',
      AUTH(),
      ['acs:ram::1:role/r', 'policy-json']
    );
  });

  it('ram 域暴露 manifest 中全部方法', () => {
    const ram = loadPreload('capabilities/ram.js');

    expect(typeof ram.listUsers).toBe('function');
    expect(typeof ram.createAccessKey).toBe('function');
    expect(typeof ram.listAccessKeys).toBe('function');
  });
});

function AUTH() {
  return { accessKeyId: 'ak', accessKeySecret: 'sk' };
}