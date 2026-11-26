import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// V-06（P5/R-P5-03）：分页追加快照 —— 顺序稳定、无重复/丢失、累计耗时不呈平方增长。
vi.mock('@renderer/services/oss-client.js', () => ({
  ossClient: { listFiles: vi.fn() },
}));

import { ossClient } from '@renderer/services/oss-client.js';
import { useFilesStore } from '@renderer/stores/files.js';

const PAGE = 1000;

function pageData(page) {
  const list = [];
  for (let i = 0; i < PAGE; i += 1) {
    const n = page * PAGE + i;
    list.push({
      name: 'obj-' + n,
      path: 'obj-' + n,
      isFolder: false,
      size: n,
      lastModified: '2026-01-01T00:00:00.000Z',
      storageClass: 'Standard',
    });
  }
  return list;
}

describe('files store 分页追加（V-06）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    ossClient.listFiles.mockReset();
  });

  it('5×1000 追加：总数、顺序、无重复', async () => {
    const store = useFilesStore();
    store.bucket = 'b';
    store.region = 'oss-cn-hangzhou';
    store.prefix = '';
    store.marker = null;

    let page = 0;
    ossClient.listFiles.mockImplementation(() => {
      const data = pageData(page);
      const marker = page < 4 ? 'm-' + (page + 1) : null;
      page += 1;
      return Promise.resolve({ data, marker });
    });

    const started = Date.now();
    await store.loadObjects(true);
    for (let i = 0; i < 4; i += 1) {
      await store.loadMore();
    }
    const elapsed = Date.now() - started;

    expect(store.items.length).toBe(5000);
    const names = store.items.map((x) => x.name);
    expect(new Set(names).size).toBe(5000);
    expect(names[0]).toBe('obj-0');
    expect(names[4999]).toBe('obj-4999');
    expect(elapsed).toBeLessThan(2000);
  });

  it('排序态追加：目录置顶 + 线性归并保持有序', async () => {
    const store = useFilesStore();
    store.bucket = 'b';
    store.region = 'oss-cn-hangzhou';
    store.prefix = '';
    store.marker = null;
    store.sortKey = 'name';
    store.sortDir = 'asc';

    let page = 0;
    ossClient.listFiles.mockImplementation(() => {
      const data = page === 0
        ? [
            { name: 'z-file', path: 'z-file', isFolder: false, size: 1 },
            { name: 'b-folder', path: 'b-folder/', isFolder: true, size: 0 },
            { name: 'a-file', path: 'a-file', isFolder: false, size: 1 },
          ]
        : [
            { name: 'y-folder', path: 'y-folder/', isFolder: true, size: 0 },
            { name: 'b-file', path: 'b-file', isFolder: false, size: 1 },
          ];
      const marker = page === 0 ? 'm-1' : null;
      page += 1;
      return Promise.resolve({ data, marker });
    });

    await store.loadObjects(true);
    await store.loadMore();

    const names = store.items.map((x) => x.name);
    expect(names[0]).toBe('b-folder');
    expect(names[1]).toBe('y-folder');
    expect(names.slice(2)).toEqual(['a-file', 'b-file', 'z-file']);
  });
});