import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createHash } from 'node:crypto';
import { useTransferStore } from '@renderer/stores/transfer.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { newProgFileName, legacyProgFileName } from '@renderer/services/prog-naming.js';

// B3-15：断点续传旧命名兼容与迁移（旧文件存在 / 损坏按空 / 迁移失败保留旧文件 / 账号隔离）

const AUTH = { id: 'LTAI-legacy-ak', secret: 'sk', eptpl: 'https://{region}.aliyuncs.com' };
// digest 覆盖后再求值（模块加载时 setup 的 digest stub 为简化实现）
let LEGACY = '';
let TARGET = '';

let storageCalls = [];
let transferCalls = [];
let files = {};

function sha256(text) {
  return createHash('sha256').update(String(text || '')).digest('hex');
}

function installStorage(renameResult) {
  storageCalls = [];
  window.ossBrowser.storage = {
    readProgress: (name) => {
      storageCalls.push(['read', name]);
      if (Object.prototype.hasOwnProperty.call(files, name)) {
        return Promise.resolve({ ok: true, data: { exists: true, content: files[name] } });
      }
      return Promise.resolve({ ok: true, data: { exists: false, content: '' } });
    },
    writeProgress: (name, content) => {
      storageCalls.push(['write', name, content]);
      files[name] = content;
      return Promise.resolve({ ok: true, data: true });
    },
    renameProgress: (from, to) => {
      storageCalls.push(['rename', from, to]);
      if (renameResult && renameResult.ok === false) {
        return Promise.resolve(renameResult);
      }
      if (Object.prototype.hasOwnProperty.call(files, from)) {
        files[to] = files[from];
        delete files[from];
      }
      return Promise.resolve({ ok: true, data: true });
    },
    listProgress: () => Promise.resolve({ ok: true, data: Object.keys(files) }),
  };
}

function installTransfer() {
  transferCalls = [];
  window.ossBrowser.transfer = {
    subscribe: () => 'sub-1',
    unsubscribe: () => {},
    createUpload: (auth, options) => {
      transferCalls.push(['createUpload', options]);
      return Promise.resolve({ ok: true, data: { taskId: 'up-1' } });
    },
    pause: (id) => {
      transferCalls.push(['pause', id]);
      return Promise.resolve({ ok: true, data: true });
    },
  };
}

function installDigest() {
  window.ossBrowser.digest = {
    sha256Hex: (text) => ({ ok: true, data: sha256(text) }),
  };
}

const PROGRESS_JSON = JSON.stringify([
  {
    from: { bucket: 'b', key: 'dir/a.txt', path: 'C:/a.txt' },
    to: { bucket: 'b', key: 'dir/a.txt' },
    region: 'r',
    status: 'running',
    prog: { loaded: 1, total: 10 },
  },
]);

beforeEach(() => {
  setActivePinia(createPinia());
  files = {};
  vi.restoreAllMocks();
  installDigest();
  installTransfer();
  LEGACY = legacyProgFileName('upprog_', AUTH.id);
  TARGET = newProgFileName('upprog_', AUTH.id);
  useAuthStore().info = Object.assign({}, AUTH);
});

describe('断点续传命名迁移', () => {
  it('旧明文文件存在：rename 到脱敏命名并恢复任务（内容字段零变更）', async () => {
    files[LEGACY] = PROGRESS_JSON;
    installStorage();

    const store = useTransferStore();
    store.subscribe();
    await store.loadProgress();

    const rename = storageCalls.find((c) => c[0] === 'rename');
    expect(rename[1]).toBe(LEGACY);
    expect(rename[2]).toBe(TARGET);
    expect(rename[2].indexOf(AUTH.id)).toBe(-1);
    expect(files[TARGET]).toBe(PROGRESS_JSON);

    expect(transferCalls.some((c) => c[0] === 'createUpload')).toBe(true);
    expect(store.uploads.length).toBe(1);
    expect(store.uploads[0].status).toBe('stopped');
    expect(transferCalls.some((c) => c[0] === 'pause')).toBe(true);
  });

  it('损坏内容：迁移后按空处理，不创建任务且不抛错', async () => {
    files[LEGACY] = '{broken json';
    installStorage();

    const store = useTransferStore();
    store.subscribe();
    await expect(store.loadProgress()).resolves.toEqual([]);

    expect(files[TARGET]).toBe('{broken json');
    expect(transferCalls.some((c) => c[0] === 'createUpload')).toBe(false);
  });

  it('迁移失败：保留旧文件并继续读取旧名（进度不丢）', async () => {
    files[LEGACY] = PROGRESS_JSON;
    installStorage({ ok: false, code: 'IO', message: 'rename failed' });

    const store = useTransferStore();
    store.subscribe();
    await store.loadProgress();

    expect(storageCalls.some((c) => c[0] === 'rename')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(files, LEGACY)).toBe(true);
    expect(storageCalls.some((c) => c[0] === 'read' && c[1] === LEGACY)).toBe(true);
    expect(store.uploads.length).toBe(1);
  });

  it('不同账号命名隔离：目标名/旧名均含各自 ak 标识哈希', () => {
    const a = newProgFileName('upprog_', 'LTAI-A');
    const b = newProgFileName('upprog_', 'LTAI-B');
    expect(a).not.toBe(b);
    expect(a).toBe('upprog_' + sha256('LTAI-A').slice(0, 16) + '.json');
    expect(legacyProgFileName('downprog_', 'LTAI-A')).toBe('downprog_LTAI-A.json');
  });
});