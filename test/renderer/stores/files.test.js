import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFilesStore } from '@renderer/stores/files.js';

// B3-01：files store 单一来源契约（导航/分页/搜索/视图/排序/选中/重置）
const VIEW_LS_KEY = 'is-list-view';

function stubOss(handlers) {
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = {
    listAllBuckets: handlers.listAllBuckets || (() => Promise.resolve({ ok: true, data: [] })),
    listFiles: handlers.listFiles || (() => Promise.resolve({ ok: true, data: [], marker: null })),
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.oss;
});

describe('files store：视图模式', () => {
  it('默认列表视图；setView(blocks) 持久化 is-list-view=false', () => {
    const store = useFilesStore();
    expect(store.viewMode).toBe('list');
    store.setView('blocks');
    expect(store.viewMode).toBe('blocks');
    expect(localStorage.getItem(VIEW_LS_KEY)).toBe('false');
    store.setView('list');
    expect(localStorage.getItem(VIEW_LS_KEY)).toBe('true');
  });

  it('is-list-view=false 启动时恢复块视图（等价 list-view-options != "false"）', () => {
    localStorage.setItem(VIEW_LS_KEY, 'false');
    const store = useFilesStore();
    expect(store.viewMode).toBe('blocks');
  });
});

describe('files store：bucket 与对象列表', () => {
  it('loadBuckets 填充列表并复位 loading', async () => {
    stubOss({
      listAllBuckets: (auth) =>
        Promise.resolve({ ok: true, data: [{ name: 'b1', region: 'oss-cn-hangzhou' }] }),
    });
    const store = useFilesStore();
    const buckets = await store.loadBuckets();
    expect(buckets.length).toBe(1);
    expect(store.bucketsLoaded).toBe(true);
    expect(store.isLoading).toBe(false);
    expect(store.isBucketList).toBe(true);
  });

  it('navigate 解析 oss:// 地址并加载对象；未截断时 hasMore=false', async () => {
    const calls = [];
    stubOss({
      listFiles: (auth, region, bucket, key, marker) => {
        calls.push({ region, bucket, key, marker });
        return Promise.resolve({
        ok: true,
        data: { data: [{ name: 'a/', path: 'a/', isFolder: true }], marker: null },
      });
      },
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://b1/pre/');
    expect(calls[0]).toEqual({ region: 'oss-cn-hangzhou', bucket: 'b1', key: 'pre/', marker: '' });
    expect(store.items.length).toBe(1);
    expect(store.bucket).toBe('b1');
    expect(store.prefix).toBe('pre/');
    expect(store.isBucketList).toBe(false);
    expect(store.hasMore).toBe(false);
    expect(store.isLoading).toBe(false);
  });

  it('loadMore 携带 marker 续拉并 concat；加载中不重复触发', async () => {
    let n = 0;
    stubOss({
      listFiles: (auth, region, bucket, key, marker) => {
        n++;
        return Promise.resolve({
          ok: true,
          data: {
            data: [{ name: 'f' + n + '.txt', path: 'f' + n + '.txt', isFile: true }],
            marker: n === 1 ? 'tok-2' : null,
          },
        });
      },
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://b1/');
    expect(store.items.length).toBe(1);
    expect(store.hasMore).toBe(true);

    const p1 = store.loadMore();
    const p2 = store.loadMore();
    await Promise.all([p1, p2]);
    expect(n).toBe(2);
    expect(store.items.length).toBe(2);
    expect(store.items[1].name).toBe('f2.txt');
    expect(store.hasMore).toBe(false);
  });

  it('enterFolder/goUp 前缀拼接与去尾段（等价 goIn/地址回退）', async () => {
    stubOss({
      listFiles: (auth) => Promise.resolve({ ok: true, data: [], marker: null }),
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://b1/');
    await store.enterFolder({ path: 'docs/2024/' });
    expect(store.prefix).toBe('docs/2024/');
    await store.goUp();
    expect(store.prefix).toBe('docs/');
    await store.goUp();
    expect(store.prefix).toBe('');
    const r = await store.goUp();
    expect(store.prefix).toBe('');
    expect(r).toBe(null);
  });

  it('search 以服务端 prefix 过滤重新拉取（等价 key += keyword）', async () => {
    const calls = [];
    stubOss({
      listFiles: (auth, region, bucket, key, marker) => {
        calls.push({ key });
        return Promise.resolve({ ok: true, data: [], marker: null });
      },
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://b1/logs/');
    await store.search('2024-');
    expect(calls[1].key).toBe('logs/2024-');
    expect(store.searchKeyword).toBe('2024-');
  });
});

describe('files store：排序', () => {
  async function seeded() {
    stubOss({
      listFiles: (auth) =>
        Promise.resolve({
          ok: true,
          data: {
            data: [
              { name: 'b.txt', path: 'b.txt', isFile: true, size: 20, lastModified: '2024-01-02' },
              { name: 'a/', path: 'a/', isFolder: true },
              { name: 'a.txt', path: 'a.txt', isFile: true, size: 30, lastModified: '2024-01-01' },
            ],
            marker: null,
          },
        }),
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://b1/');
    return store;
  }

  it('setSort(name) 按名称升序且目录置顶；同键再切翻转方向', async () => {
    const store = await seeded();
    store.setSort('name');
    expect(store.items.map((i) => i.name)).toEqual(['a/', 'a.txt', 'b.txt']);
    store.setSort('name');
    expect(store.sortDir).toBe('desc');
    expect(store.items.map((i) => i.name)).toEqual(['a/', 'b.txt', 'a.txt']);
  });

  it('setSort(size) 数值排序（目录段不受影响）', async () => {
    const store = await seeded();
    store.setSort('size');
    expect(store.items.filter((i) => i.isFile).map((i) => i.size)).toEqual([20, 30]);
    expect(store.items[0].isFolder).toBe(true);
  });

  it('sortKey=null 时保持服务端顺序（目录置顶原序）', async () => {
    const store = await seeded();
    expect(store.items.map((i) => i.name)).toEqual(['b.txt', 'a/', 'a.txt']);
    expect(store.sortKey).toBe(null);
  });
});

describe('files store：选中（sel 双轨等价）', () => {
  async function seeded() {
    stubOss({
      listFiles: (auth) =>
        Promise.resolve({
          ok: true,
          data: {
            data: [
              { name: '1.txt', path: '1.txt', isFile: true },
              { name: '2.txt', path: '2.txt', isFile: true },
              { name: '3.txt', path: '3.txt', isFile: true },
            ],
            marker: null,
          },
        }),
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.navigate('oss://b1/');
    return store;
  }

  it('selectAll 翻转并派生 selectedList；再切清空', async () => {
    const store = await seeded();
    store.selectAll();
    expect(store.selectedAll).toBe(true);
    expect(store.selectedList.length).toBe(3);
    expect(store.selectedMap).toEqual({ i_0: true, i_1: true, i_2: true });
    store.selectAll();
    expect(store.selectedAll).toBe(false);
    expect(store.selectedList.length).toBe(0);
  });

  it('selectChanged 单击选中/取消；shift 区间批量；全选态派生', async () => {
    const store = await seeded();
    store.selectChanged(1, false);
    expect(store.selectedList.map((i) => i.name)).toEqual(['2.txt']);
    expect(store.selectedAll).toBe(false);
    store.selectChanged(2, true);
    expect(store.selectedList.map((i) => i.name)).toEqual(['2.txt', '3.txt']);
    store.selectChanged(0, true);
    expect(store.selectedAll).toBe(true);
    store.selectChanged(0, false);
    expect(store.selectedAll).toBe(false);
    expect(store.selectedList.length).toBe(2);
  });

  it('loadObjects 重置后清空选中（等价 initSelect 由 clearObjectsList 调用）', async () => {
    const store = await seeded();
    store.selectChanged(0, false);
    expect(store.selectedList.length).toBe(1);
    await store.loadObjects(true);
    expect(store.selectedList.length).toBe(0);
    expect(store.selectedAll).toBe(false);
  });
});

describe('files store：reset（账号切换清空）', () => {
  it('reset 后无上一账号残留', async () => {
    stubOss({
      listAllBuckets: (auth) =>
        Promise.resolve({ ok: true, data: [{ name: 'b1', region: 'r1' }] }),
      listFiles: (auth) =>
        Promise.resolve({ ok: true, data: [{ name: 'f.txt', path: 'f.txt', isFile: true }], marker: 'tok' }),
    });
    const store = useFilesStore();
    store.region = 'oss-cn-hangzhou';
    await store.loadBuckets();
    await store.navigate('oss://b1/pre/');
    store.selectChanged(0, false);
    store.setSort('name');

    store.reset();
    expect(store.buckets).toEqual([]);
    expect(store.items).toEqual([]);
    expect(store.marker).toBe(null);
    expect(store.bucket).toBe('');
    expect(store.prefix).toBe('');
    expect(store.region).toBe('');
    expect(store.sortKey).toBe(null);
    expect(store.selectedList).toEqual([]);
    expect(store.isBucketList).toBe(true);
    expect(store.hasMore).toBe(false);
    expect(store.isLoading).toBe(false);
  });
});