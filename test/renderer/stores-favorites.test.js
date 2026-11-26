import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFavoritesStore } from '@renderer/stores/favorites.js';

describe('favorites 收藏地址规范化', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('尾斜杠差异不影响收藏判定、去重与删除', () => {
    const store = useFavoritesStore();
    store.items = [{ url: 'oss://bucket/dir/', time: 1 }];

    expect(store.has('oss://bucket/dir')).toBe(true);
    expect(store.has('oss://bucket/dir/')).toBe(true);
    expect(store.has('oss://bucket/other')).toBe(false);

    expect(store.add('oss://bucket/dir')).toBe(true);
    expect(store.items.length).toBe(1);

    store.remove('oss://bucket/dir/');
    expect(store.items.length).toBe(0);
  });
});