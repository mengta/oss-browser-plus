import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadPreload } from './helpers/preload-env.js';

const nodeRequire = createRequire(import.meta.url);
const fs = nodeRequire('fs');
const os = nodeRequire('os');

let tmpHome;
let storage;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-storage-'));
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  storage = loadPreload('capabilities/storage.js');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function configDir() {
  return path.join(tmpHome, '.oss-browser');
}

describe('preload capabilities/storage 进度文件', () => {
  it('writeProgress 写入后 readProgress 能读到相同内容', () => {
    expect(storage.writeProgress('upprog_a.json', '{"done":1}')).toBe(true);

    expect(storage.readProgress('upprog_a.json')).toEqual({
      exists: true,
      content: '{"done":1}',
    });
  });

  it('readProgress 文件不存在时返回 exists=false 与空内容', () => {
    expect(storage.readProgress('downprog_missing.json')).toEqual({ exists: false, content: '' });
  });

  it('writeProgress 原子写完成后不残留 .tmp 文件', () => {
    storage.writeProgress('upprog_atomic.json', 'payload');

    expect(fs.readdirSync(configDir()).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    expect(fs.readFileSync(path.join(configDir(), 'upprog_atomic.json'), 'utf8')).toBe('payload');
  });

  it.each([
    ['空字符串', ''],
    ['带正斜杠', 'a/b.json'],
    ['带反斜杠', 'a\\b.json'],
    ['含上跳片段', '../x.json'],
    ['非字符串', 42],
  ])('readProgress 拒绝非法文件名（%s）并抛 INVALID_ARG', (_label, name) => {
    expect(() => storage.readProgress(name)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('writeProgress 的 content 必须是字符串', () => {
    expect(() => storage.writeProgress('upprog_a.json', {})).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('writeProgress 写入失败时抛 IO 并清理临时文件', () => {
    storage.writeProgress('upprog_keep.json', 'old');
    vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('EACCES');
    });

    expect(() => storage.writeProgress('upprog_keep.json', 'new')).toThrowError(
      expect.objectContaining({ code: 'IO', message: 'failed to write upprog_keep.json' })
    );
    expect(storage.readProgress('upprog_keep.json').content).toBe('old');
  });

  it('readProgress 在非 ENOENT 错误时抛 IO', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      const err = new Error('denied');
      err.code = 'EACCES';
      throw err;
    });

    expect(() => storage.readProgress('upprog_a.json')).toThrowError(
      expect.objectContaining({ code: 'IO' })
    );
  });

  it('listProgress 只返回指定前缀的 .json 且按名称排序', () => {
    storage.writeProgress('upprog_b.json', '1');
    storage.writeProgress('upprog_a.json', '2');
    storage.writeProgress('downprog_c.json', '3');
    storage.writeProgress('upprog_notes.txt', '4');

    expect(storage.listProgress('upprog_')).toEqual(['upprog_a.json', 'upprog_b.json']);
    expect(storage.listProgress('downprog_')).toEqual(['downprog_c.json']);
  });

  it('listProgress 拒绝未知前缀', () => {
    expect(() => storage.listProgress('other_')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('listProgress 读目录失败时抛 IO', () => {
    vi.spyOn(fs, 'readdirSync').mockImplementationOnce(() => {
      throw new Error('EACCES');
    });

    expect(() => storage.listProgress('upprog_')).toThrowError(
      expect.objectContaining({ code: 'IO' })
    );
  });

  it('renameProgress 迁移旧文件，源不存在时视为成功', () => {
    storage.writeProgress('upprog_old.json', 'x');

    expect(storage.renameProgress('upprog_old.json', 'upprog_new.json')).toBe(true);
    expect(storage.readProgress('upprog_new.json').exists).toBe(true);
    expect(storage.readProgress('upprog_old.json').exists).toBe(false);
    expect(storage.renameProgress('upprog_absent.json', 'upprog_new2.json')).toBe(true);
  });

  it('renameProgress 失败时抛 IO', () => {
    storage.writeProgress('upprog_old.json', 'x');
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('EXDEV');
    });

    expect(() => storage.renameProgress('upprog_old.json', 'upprog_new.json')).toThrowError(
      expect.objectContaining({ code: 'IO' })
    );
    expect(storage.readProgress('upprog_old.json').exists).toBe(true);
  });
});

describe('preload capabilities/storage 收藏文件', () => {
  it('writeFavorites 写入后 readFavorites 返回原内容', () => {
    expect(storage.writeFavorites('zhangsan', '[{"name":"bucket-a"}]')).toBe(true);
    expect(storage.readFavorites('zhangsan')).toBe('[{"name":"bucket-a"}]');
    expect(fs.readdirSync(configDir())).toContain('fav_zhangsan.json');
  });

  it('readFavorites 文件不存在时返回空串', () => {
    expect(storage.readFavorites('nobody')).toBe('');
  });

  it('readFavorites 在非 ENOENT 错误时抛 IO', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      const err = new Error('denied');
      err.code = 'EACCES';
      throw err;
    });

    expect(() => storage.readFavorites('zhangsan')).toThrowError(
      expect.objectContaining({ code: 'IO' })
    );
  });

  it('收藏用户名必须是纯 basename', () => {
    expect(() => storage.readFavorites('a/b')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
    expect(() => storage.readFavorites(123)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });

  it('writeFavorites 的 content 必须是字符串', () => {
    expect(() => storage.writeFavorites('zhangsan', null)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARG' })
    );
  });
});

describe('preload capabilities/bootstrap', () => {
  it('在没有 custom/node 定制时回退默认标识', () => {
    const bootstrap = loadPreload('capabilities/bootstrap.js');

    const snapshot = bootstrap.get();

    expect(snapshot.appId).toBe('oss-browser');
    expect(snapshot.appTitle).toBe('OSS Browser');
    expect(snapshot.logo).toBe('icons/icon.png');
    expect(snapshot.aboutHtml).toBe('');
    expect(snapshot.appName).toBeNull();
    expect(snapshot.releaseNotesUrl).toContain('release-notes');
    expect(snapshot.upgradeUrl).toContain('upgrade.json');
    expect(snapshot.configPath).toBe(path.join(tmpHome, '.oss-browser'));
    expect(snapshot.platform).toBe(process.platform);
    expect(snapshot.appVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('快照在首次构建后缓存复用', () => {
    const bootstrap = loadPreload('capabilities/bootstrap.js');

    expect(bootstrap.get()).toBe(bootstrap.get());
  });

  it('进入开发模式时 isDev 为 true，并携带 location.hash', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const originalHash = window.location.hash;
    window.history.replaceState({}, '', '#/files');
    try {
      const bootstrap = loadPreload('capabilities/bootstrap.js');

      const snapshot = bootstrap.get();
      expect(snapshot.isDev).toBe(true);
      expect(snapshot.entryHash).toBe('#/files');
    } finally {
      process.env.NODE_ENV = originalEnv;
      window.history.replaceState({}, '', originalHash || '#');
    }
  });

  it('custom 模块缺失项回退默认值，appVersion 取自 custom.version', () => {
    const Module = nodeRequire('module');
    const originalRequire = Module.prototype.require;
    const customStub = { appId: 'custom-id', appName: 'not-an-object', version: '9.9.9' };
    const spy = vi.spyOn(Module.prototype, 'require').mockImplementation(function (request, ...rest) {
      if (String(request).replace(/\\/g, '/').endsWith('/custom/index.js')) return customStub;
      return originalRequire.call(this, request, ...rest);
    });
    try {
      const bootstrap = loadPreload('capabilities/bootstrap.js');
      const snapshot = bootstrap.get();

      expect(snapshot.appId).toBe('custom-id');
      expect(snapshot.appVersion).toBe('9.9.9');
      expect(snapshot.appName).toBeNull();
      expect(snapshot.appTitle).toBe('OSS Browser');
    } finally {
      spy.mockRestore();
    }
  });

  it('正常化文案包：跳过非法条目并回退缺省 label/content', () => {
    const Module = nodeRequire('module');
    const originalRequire = Module.prototype.require;
    const localesStub = {
      'zh-CN': { label: '简体中文', content: { hello: '你好' } },
      'en-US': { content: { hello: 'Hello' } },
      'ja-JP': { label: 3, content: [] },
      broken: 'not-an-object',
    };
    const spy = vi.spyOn(Module.prototype, 'require').mockImplementation(function (request, ...rest) {
      if (String(request).replace(/\\/g, '/').endsWith('/node/i18n')) return localesStub;
      return originalRequire.call(this, request, ...rest);
    });
    try {
      const bootstrap = loadPreload('capabilities/bootstrap.js');
      const snapshot = bootstrap.get();

      expect(Object.keys(snapshot.locales)).toEqual(['zh-CN', 'en-US', 'ja-JP']);
      expect(snapshot.locales['zh-CN']).toEqual({ label: '简体中文', content: { hello: '你好' } });
      expect(snapshot.locales['en-US']).toEqual({ label: 'en-US', content: { hello: 'Hello' } });
      // content 为数组属非法文案包，回退空对象
      expect(snapshot.locales['ja-JP']).toEqual({ label: 'ja-JP', content: {} });
    } finally {
      spy.mockRestore();
    }
  });
});