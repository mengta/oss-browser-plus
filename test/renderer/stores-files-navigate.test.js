import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  listAllBuckets: vi.fn(),
  listFiles: vi.fn(),
}));

vi.mock('@renderer/services/oss-client.js', () => {
  const client = {
    listAllBuckets: mocks.listAllBuckets,
    listFiles: mocks.listFiles,
  };
  return { ossClient: client, default: client };
});

const { useFilesStore } = await import('@renderer/stores/files.js');

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.listAllBuckets.mockReset();
  mocks.listFiles.mockReset();
});

describe('files store：navigate 的 region 解析与错误可见性', () => {
  it('buckets 未加载时先列举 bucket 拿到 region，再按 region 列对象', async () => {
    mocks.listAllBuckets.mockResolvedValue([{ name: 'b1', region: 'oss-cn-hangzhou' }]);
    mocks.listFiles.mockResolvedValue({
      data: [{ name: 'a.txt', path: 'dir/a.txt', isFile: true }],
      marker: null,
    });

    const store = useFilesStore();
    const items = await store.navigate('oss://b1/dir/');

    expect(mocks.listAllBuckets).toHaveBeenCalled();
    expect(mocks.listFiles).toHaveBeenCalledWith('oss-cn-hangzhou', 'b1', 'dir/', '');
    expect(store.region).toBe('oss-cn-hangzhou');
    expect(items.length).toBe(1);
  });

  it('已有 region 时不重复列举 bucket', async () => {
    mocks.listFiles.mockResolvedValue({ data: [], marker: null });
    const store = useFilesStore();
    store.region = 'oss-cn-beijing';

    await store.navigate('oss://b2/');

    expect(mocks.listAllBuckets).not.toHaveBeenCalled();
    expect(mocks.listFiles).toHaveBeenCalledWith('oss-cn-beijing', 'b2', '', '');
  });

  it('列举失败（仅对象权限）不阻断导航，继续请求对象列表', async () => {
    const err = new Error('AccessDenied');
    err.code = 'AccessDenied';
    mocks.listAllBuckets.mockRejectedValue(err);
    mocks.listFiles.mockResolvedValue({ data: [], marker: null });

    const store = useFilesStore();
    const items = await store.navigate('oss://b3/');

    expect(mocks.listFiles).toHaveBeenCalledWith('', 'b3', '', '');
    expect(items).toEqual([]);
  });

  it('对象列表失败时清空当前页并向上抛出（供调用方提示）', async () => {
    const err = new Error('AccessDenied');
    err.code = 'AccessDenied';
    mocks.listFiles.mockRejectedValue(err);
    const store = useFilesStore();
    store.bucket = 'b4';
    store.items = [{ name: 'stale' }];

    await expect(store.loadObjects(true)).rejects.toThrow('AccessDenied');
    expect(store.items).toEqual([]);
    expect(store.isLoading).toBe(false);
  });
});