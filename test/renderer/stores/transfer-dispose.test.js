import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTransferStore } from '@renderer/stores/transfer.js';

// V-05（P7a/R-P7-05）：传输订阅必须保存 subscriptionId 并可解绑，重复 subscribe 只保留一个。
describe('transfer store 订阅解绑（V-05）', () => {
  let subscribeCalls;
  let unsubscribeCalls;

  beforeEach(() => {
    setActivePinia(createPinia());
    subscribeCalls = [];
    unsubscribeCalls = [];
    window.ossBrowser.transfer = {
      subscribe: (cb) => {
        subscribeCalls.push(cb);
        return 'sub-' + subscribeCalls.length;
      },
      unsubscribe: (id) => {
        unsubscribeCalls.push(id);
        return Promise.resolve({ ok: true, data: true });
      },
      getTasks: () => Promise.resolve({ ok: true, data: [] }),
      clearFailed: () => Promise.resolve({ ok: true, data: true }),
    };
  });

  it('subscribe 保存 id，重复调用不新增订阅', () => {
    const store = useTransferStore();
    store.subscribe();
    store.subscribe();
    expect(subscribeCalls.length).toBe(1);
    expect(store.subscriptionId).toBe('sub-1');
    expect(store.subscribed).toBe(true);
  });

  it('dispose 调用 unsubscribe(id) 并复位状态', () => {
    const store = useTransferStore();
    store.subscribe();
    store.dispose();
    expect(unsubscribeCalls).toEqual(['sub-1']);
    expect(store.subscribed).toBe(false);
    expect(store.subscriptionId).toBe('');
  });

  it('dispose 后再次 subscribe 重新建立订阅', () => {
    const store = useTransferStore();
    store.subscribe();
    store.dispose();
    store.subscribe();
    expect(subscribeCalls.length).toBe(2);
    expect(store.subscriptionId).toBe('sub-2');
  });

  it('dispose 幂等：未订阅时不调用 unsubscribe', () => {
    const store = useTransferStore();
    store.dispose();
    expect(unsubscribeCalls.length).toBe(0);
  });
});