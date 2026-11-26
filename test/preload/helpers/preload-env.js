import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const nodeRequire = createRequire(import.meta.url);
const PRELOAD_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../app/preload');

/**
 * 构造 electron 运行时替身。preload 层只用到 ipcRenderer / shell / webUtils / contextBridge。
 */
export function createElectronMock(overrides = {}) {
  const ipcRenderer = {
    invoke: vi.fn(() => Promise.resolve({ ok: true, data: null })),
    sendSync: vi.fn(() => ({ ok: true, data: true })),
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    ...(overrides.ipcRenderer || {}),
  };
  const shell = {
    openExternal: vi.fn(() => Promise.resolve()),
    showItemInFolder: vi.fn(),
    ...(overrides.shell || {}),
  };
  const webUtils = {
    getPathForFile: vi.fn(() => 'C:/tmp/sample.txt'),
    ...(overrides.webUtils || {}),
  };
  const contextBridge = {
    exposeInMainWorld: vi.fn(),
    ...(overrides.contextBridge || {}),
  };
  return { ipcRenderer, shell, webUtils, contextBridge };
}

/**
 * preload 是 CommonJS，内部 `require('electron')` 走 Node 原生解析，
 * 因此必须把替身写入 Node 模块缓存，vi.mock 无法拦截。
 */
export function installElectronMock(mock) {
  const entry = nodeRequire.resolve('electron');
  nodeRequire.cache[entry] = {
    id: entry,
    filename: entry,
    loaded: true,
    exports: mock,
    children: [],
    paths: [],
  };
  return mock;
}

/**
 * 重新加载 preload 模块：清空 app/preload 下全部缓存，
 * 保证每个用例内的 capability 都绑定当前 electron 替身。
 */
export function loadPreload(relativePath) {
  const id = nodeRequire.resolve('../../../app/preload/' + relativePath);
  for (const key of Object.keys(nodeRequire.cache)) {
    if (key.startsWith(PRELOAD_ROOT)) delete nodeRequire.cache[key];
  }
  return nodeRequire(id);
}

export function resolvedPreloadPath(relativePath) {
  return nodeRequire.resolve('../../../app/preload/' + relativePath);
}