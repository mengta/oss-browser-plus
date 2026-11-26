import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElectronMock, installElectronMock, loadPreload } from './helpers/preload-env.js';

const KEY_B64 = Buffer.alloc(32, 7).toString('base64');

let electron;
let credentials;

beforeEach(() => {
  electron = createElectronMock();
  installElectronMock(electron);
  credentials = loadPreload('capabilities/credentials.js');
});

describe('preload capabilities/credentials 系统凭证通道', () => {
  it('isAvailable 解包 ok 信封并返回布尔值', () => {
    electron.ipcRenderer.sendSync.mockReturnValueOnce({ ok: true, data: true });

    expect(credentials.isAvailable()).toBe(true);
    expect(electron.ipcRenderer.sendSync).toHaveBeenCalledWith('credentials:is-available');
  });

  it('isAvailable 遇到失败信封时抛出带 code 的错误', () => {
    electron.ipcRenderer.sendSync.mockReturnValueOnce({
      ok: false,
      code: 'UNAVAILABLE',
      message: 'no keyring',
    });

    expect(() => credentials.isAvailable()).toThrowError(
      expect.objectContaining({ code: 'UNAVAILABLE', message: 'no keyring' })
    );
  });

  it('isAvailableAsync 只有主进程返回 true 才算可用', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce(true);
    await expect(credentials.isAvailableAsync()).resolves.toBe(true);

    electron.ipcRenderer.invoke.mockResolvedValueOnce('true');
    await expect(credentials.isAvailableAsync()).resolves.toBe(false);
  });

  it('isAvailableAsync 把底层异常包装为 INTERNAL', async () => {
    electron.ipcRenderer.invoke.mockRejectedValueOnce(new Error('ipc down'));

    await expect(credentials.isAvailableAsync()).rejects.toMatchObject({
      code: 'INTERNAL',
      message: 'ipc down',
    });
  });

  it('protect/release 校验参数类型并透传通道', () => {
    electron.ipcRenderer.sendSync.mockReturnValue({ ok: true, data: 'PROT' });

    expect(credentials.protect('YWJj')).toBe('PROT');
    expect(electron.ipcRenderer.sendSync).toHaveBeenCalledWith('credentials:protect', 'YWJj');
    expect(credentials.release('PROT')).toBe('PROT');
    expect(electron.ipcRenderer.sendSync).toHaveBeenCalledWith('credentials:release', 'PROT');

    expect(() => credentials.protect(null)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => credentials.release(1)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });
});

describe('preload capabilities/credentials AES-256-GCM', () => {
  it('加密后能用同一密钥解出原文', () => {
    const plainB64 = Buffer.from('secret-token', 'utf8').toString('base64');

    const cipherB64 = credentials.aesGcmEncrypt(KEY_B64, plainB64);

    expect(cipherB64).not.toContain('secret');
    expect(credentials.aesGcmDecrypt(KEY_B64, cipherB64)).toBe(plainB64);
  });

  it('每次加密使用随机 IV，密文不重复', () => {
    const plainB64 = Buffer.from('same', 'utf8').toString('base64');

    expect(credentials.aesGcmEncrypt(KEY_B64, plainB64)).not.toBe(
      credentials.aesGcmEncrypt(KEY_B64, plainB64)
    );
  });

  it('篡改密文导致解密失败（GCM 认证标签校验）', () => {
    const plainB64 = Buffer.from('tamper-me', 'utf8').toString('base64');
    const cipherB64 = credentials.aesGcmEncrypt(KEY_B64, plainB64);
    const raw = Buffer.from(cipherB64, 'base64');
    // eslint-disable-next-line no-bitwise -- 篡改最后一个字节以触发 GCM 校验失败
    raw[raw.length - 1] ^= 0xff;

    expect(() => credentials.aesGcmDecrypt(KEY_B64, raw.toString('base64'))).toThrow();
  });

  it('非法密钥与过短密文被拒绝', () => {
    expect(() => credentials.aesGcmEncrypt('short', 'YQ==')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => credentials.aesGcmEncrypt(KEY_B64, 123)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => credentials.aesGcmDecrypt(KEY_B64, 'YQ==')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => credentials.aesGcmDecrypt(KEY_B64, '')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });
});

describe('preload capabilities/credentials v1 兼容算法', () => {
  it('默认算法（aes192 + 内置密钥）可往返', () => {
    const cipherHex = credentials.legacyCipher('{"id":"v1"}');

    expect(cipherHex).toMatch(/^[0-9a-f]+$/);
    expect(credentials.legacyDecipher(cipherHex)).toBe('{"id":"v1"}');
  });

  it.each(['aes128', 'aes-128-cbc', 'aes192', 'aes-192-cbc', 'aes256', 'aes-256-cbc'])(
    '算法 %s 可往返',
    (algorithm) => {
      const cipherHex = credentials.legacyCipher('配置密文', KEY_B64, algorithm);

      expect(credentials.legacyDecipher(cipherHex, KEY_B64, algorithm)).toBe('配置密文');
    }
  );

  it('支持 Buffer 明文与自定义密钥', () => {
    const cipherHex = credentials.legacyCipher(Buffer.from('buf', 'utf8'), KEY_B64, 'aes256');

    expect(credentials.legacyDecipher(cipherHex, KEY_B64, 'aes256')).toBe('buf');
  });

  it('拒绝不支持的算法与非法参数', () => {
    expect(() => credentials.legacyCipher('x', undefined, 'des')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => credentials.legacyDecipher(42)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => credentials.legacyCipher('x', 42)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });
});