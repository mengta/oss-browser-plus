import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { userAkStore } from '@renderer/services/user-ak-store.js';

// user-ak-store 内部的 open() 会长期持有连接，deleteDatabase 会被 blocked；
// 因此用例间用 clear() 隔离数据，而不是删除数据库。
async function clearStore() {
  const db = await userAkStore.open();
  await new Promise((resolve, reject) => {
    const request = db.transaction('subUserAK', 'readwrite').objectStore('subUserAK').clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await clearStore();
});

describe('user-ak-store 元数据', () => {
  it('冻结数据库/store 常量', () => {
    expect(userAkStore.DBNAME).toBe('subUserAkList');
    expect(userAkStore.DBVERSION).toBe(1);
    expect(userAkStore.STORENAME).toBe('subUserAK');
    expect(userAkStore.INITSTORE).toEqual({ subUserAK: { keyPath: 'AccessKeyId' } });
  });
});

describe('user-ak-store 持久化', () => {
  it('首次 open 创建对象仓库并可复用连接', async () => {
    const db = await userAkStore.open();

    expect(db.objectStoreNames.contains('subUserAK')).toBe(true);

    const second = await userAkStore.open();
    expect(second.objectStoreNames.contains('subUserAK')).toBe(true);
  });

  it('save 为 upsert：同 AccessKeyId 覆盖而非重复插入', async () => {
    await userAkStore.save({ AccessKeyId: 'ak-1', AccessKeySecret: 'sk-1', status: 'Active' });
    await userAkStore.save({ AccessKeyId: 'ak-1', AccessKeySecret: 'sk-2', status: 'Inactive' });
    await userAkStore.save({ AccessKeyId: 'ak-2', AccessKeySecret: 'sk-3' });

    const list = await userAkStore.list();

    expect(list).toHaveLength(2);
    const first = list.find((item) => item.AccessKeyId === 'ak-1');
    expect(first).toMatchObject({ AccessKeySecret: 'sk-2', status: 'Inactive' });
    expect(list.map((item) => item.AccessKeyId).sort()).toEqual(['ak-1', 'ak-2']);
  });

  it('get 命中返回记录，未命中返回 undefined', async () => {
    await userAkStore.save({ AccessKeyId: 'ak-1', AccessKeySecret: 'sk-1' });

    await expect(userAkStore.get('ak-1')).resolves.toMatchObject({ AccessKeySecret: 'sk-1' });
    await expect(userAkStore.get('missing')).resolves.toBeUndefined();
  });

  it('del 移除指定记录且不影响其它记录', async () => {
    await userAkStore.save({ AccessKeyId: 'ak-1' });
    await userAkStore.save({ AccessKeyId: 'ak-2' });

    await expect(userAkStore.del('ak-1')).resolves.toBeUndefined();
    await expect(userAkStore.get('ak-1')).resolves.toBeUndefined();
    expect((await userAkStore.list()).map((item) => item.AccessKeyId)).toEqual(['ak-2']);
  });

  it('空库 list 返回空数组', async () => {
    await expect(userAkStore.list()).resolves.toEqual([]);
  });
});