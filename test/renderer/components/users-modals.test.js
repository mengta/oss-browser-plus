import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useToastStore } from '@renderer/stores/toast.js';
import UsersModal from '@renderer/components/business/modals/UsersModal.vue';
import UserAkModal from '@renderer/components/business/modals/UserAkModal.vue';
import UserUpdateModal from '@renderer/components/business/modals/UserUpdateModal.vue';
import ModalHost from '@renderer/components/base/ModalHost.vue';
import * as SecureStore from '@renderer/services/secure-store.js';

// jsdom 无 indexedDB：以内存 map 模拟 subUserAK 存储（save 为 upsert 语义）
const akDb = vi.hoisted(() => ({ map: new Map() }));
vi.mock('@renderer/services/user-ak-store.js', () => ({
  userAkStore: {
    list: () => Promise.resolve(Array.from(akDb.map.values())),
    get: (id) => Promise.resolve(akDb.map.get(id) || null),
    save: (data) => {
      akDb.map.set(data.AccessKeyId, JSON.parse(JSON.stringify(data)));
      return Promise.resolve();
    },
    del: (id) => {
      akDb.map.delete(id);
      return Promise.resolve();
    },
  },
}));

let ramCalls = [];
let ramStubs = {};

function installRam(overrides) {
  ramCalls = [];
  ramStubs = Object.assign(
    {
      listUsers: (auth) => Promise.resolve({ ok: true,
data: [
        { UserId: 'u2', UserName: 'bob', DisplayName: '', Comments: 'b', UpdateDate: '2026-01-02T00:00:00Z' },
        { UserId: 'u1', UserName: 'alice', DisplayName: 'A', Comments: 'a', UpdateDate: '2026-01-03T00:00:00Z' },
      ] }),
      listAccessKeys: (auth, name) => Promise.resolve({ ok: true,
data: { AccessKeys: { AccessKey: [
        { AccessKeyId: 'AK-1', Status: 'Active', UpdateDate: '2026-01-02T00:00:00Z' },
      ] } } }),
      listPoliciesForUser: () => Promise.resolve({ ok: true, data: { Policies: { Policy: [] } } }),
      deleteUser: () => Promise.resolve({ ok: true, data: {} }),
      deleteAccessKey: () => Promise.resolve({ ok: true, data: {} }),
      detachPolicyFromUser: () => Promise.resolve({ ok: true, data: {} }),
      createAccessKey: () => Promise.resolve({ ok: true, data: { AccessKey: { AccessKeyId: 'AK-NEW', AccessKeySecret: 'SK-NEW' } } }),
      updateAccessKey: () => Promise.resolve({ ok: true, data: {} }),
      getUser: () => Promise.resolve({ ok: true, data: { User: { UserId: 'u1', UserName: 'alice', DisplayName: 'A2', Comments: 'c' } } }),
      updateUser: () => Promise.resolve({ ok: true, data: {} }),
    },
    overrides || {}
  );
  globalThis.window = globalThis.window || {};
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.ram = new Proxy({}, {
    get: (target, prop) => {
      if (typeof prop !== 'string') {
        return undefined;
      }
      if (ramStubs[prop]) {
        return (auth, ...args) => {
          ramCalls.push({ method: prop, auth: { id: auth && auth.id }, args });
          return ramStubs[prop](auth, ...args);
        };
      }
      return undefined;
    },
  });
}

function mountAll(component, props) {
  // 双挂载：业务弹窗 + ModalHost（承载 ui.confirm 的 ConfirmDialog 渲染）
  const wrapper = mount(component, {
    props,
    global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
  });
  const host = mount(ModalHost, {
    global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
  });
  return { wrapper, host };
}

async function flushAll() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
  await nextTick();
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('auth-info', JSON.stringify({ id: 'LTAI1', secret: 's1', region: 'oss-cn-hangzhou' }));
  SecureStore.resetDekCache();
  setActivePinia(createPinia());
  akDb.map.clear();
  installRam();
});

describe('UsersModal（B2-04 用户列表）', () => {
  it('加载用户列表并按 UpdateDate 降序', async () => {
    const { wrapper } = mountAll(UsersModal);
    await flushAll();

    const rows = wrapper.findAll('[data-testid="users-name"]');
    expect(rows.length).toBe(2);
    expect(rows[0].text()).toBe('alice');
    expect(rows[1].text()).toBe('bob');
    expect(ramCalls[0].method).toBe('listUsers');
    expect(ramCalls[0].auth.id).toBe('LTAI1');
  });

  it('搜索过滤（子串匹配）', async () => {
    const { wrapper } = mountAll(UsersModal);
    await flushAll();

    await wrapper.find('[data-testid="users-search"]').setValue('bob');
    expect(wrapper.findAll('[data-testid="users-row"]').length).toBe(1);
    expect(wrapper.find('[data-testid="users-name"]').text()).toBe('bob');
  });

  it('删除用户：确认后串行解绑策略→删 AK→删用户→刷新', async () => {
    const { wrapper, host } = mountAll(UsersModal);
    const ui = useUiStore();
    await flushAll();

    await wrapper.findAll('[data-testid="users-remove"]')[0].trigger('click');
    await flushAll();
    const okBtn = host.find('[data-testid="dialog-ok"]');
    expect(okBtn.exists()).toBe(true);
    await okBtn.trigger('click');
    await flushAll();

    const methods = ramCalls.map((c) => c.method);
    expect(methods).toContain('listPoliciesForUser');
    expect(methods).toContain('deleteUser');
    expect(methods.indexOf('deleteUser')).toBeGreaterThan(methods.indexOf('listPoliciesForUser'));
    const toast = useToastStore();
    expect(toast.items.some((item) => item.type === 'success')).toBe(true);
    expect(ui.depth).toBe(0);
  });

  it('删除取消路径不执行删除', async () => {
    const { wrapper, host } = mountAll(UsersModal);
    await flushAll();

    await wrapper.findAll('[data-testid="users-remove"]')[0].trigger('click');
    await flushAll();
    const cancelBtn = host.find('[data-testid="dialog-cancel"]');
    expect(cancelBtn.exists()).toBe(true);
    await cancelBtn.trigger('click');
    await flushAll();

    expect(ramCalls.map((c) => c.method)).not.toContain('deleteUser');
  });
});

describe('UserAkModal（B2-04 子账号 AK）', () => {
  it('AK 列表合并本地 secret（创建后回读）', async () => {
    const { wrapper } = mountAll(UserAkModal, { user: { UserName: 'alice', UserId: 'u1' } });
    await flushAll();

    expect(wrapper.findAll('[data-testid="user-ak-row"]').length).toBe(1);
    expect(wrapper.find('[data-testid="user-ak-row"]').text()).toContain('AK-1');

    await wrapper.find('[data-testid="user-ak-add"]').trigger('click');
    await flushAll();

    const created = ramCalls.find((c) => c.method === 'createAccessKey');
    expect(created).toBeTruthy();
    const saved = akDb.map.get('AK-NEW');
    expect(saved).toBeTruthy();
    expect(saved.AccessKeySecret).toBe('SK-NEW');
    expect(saved.UserName).toBe('alice');
  });

  it('状态启停：确认后 updateAccessKey', async () => {
    const { wrapper, host } = mountAll(UserAkModal, { user: { UserName: 'alice', UserId: 'u1' } });
    await flushAll();

    await wrapper.find('[data-testid="user-ak-status"]').trigger('click');
    await flushAll();
    const okBtn = host.find('[data-testid="dialog-ok"]');
    expect(okBtn.exists()).toBe(true);
    await okBtn.trigger('click');
    await flushAll();

    const updated = ramCalls.find((c) => c.method === 'updateAccessKey');
    expect(updated).toBeTruthy();
    // proxy args：[UserName, AccessKeyId, status]
    expect(updated.args[2]).toBe('Inactive');
  });
});

describe('UserUpdateModal（B2-04 用户更新）', () => {
  it('getUser 回显并提交 updateUser', async () => {
    const callback = vi.fn();
    const { wrapper } = mountAll(UserUpdateModal, { item: { UserId: 'u1', UserName: 'alice' }, callback });
    await flushAll();

    expect(wrapper.find('[data-testid="user-update-display"]').element.value).toBe('A2');

    await wrapper.find('[data-testid="user-update-submit"]').trigger('submit');
    await flushAll();

    const updated = ramCalls.find((c) => c.method === 'updateUser');
    expect(updated).toBeTruthy();
    expect(updated.args[0].UserName).toBe('alice');
    expect(callback).toHaveBeenCalled();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('用户名含非法字符时校验拦截', async () => {
    const { wrapper } = mountAll(UserUpdateModal, { item: { UserId: 'u1', UserName: 'alice' }, callback: () => {} });
    await flushAll();

    await wrapper.find('[data-testid="user-update-name"]').setValue('bad name!');
    await wrapper.find('[data-testid="user-update-submit"]').trigger('submit');
    await flushAll();

    expect(ramCalls.map((c) => c.method)).not.toContain('updateUser');
    expect(wrapper.find('[data-testid="user-update-name"]').classes().some((c) => c.indexOf('invalid') >= 0)).toBe(true);
  });

  it('手机号组合：pre + "-" + num', async () => {
    const { wrapper } = mountAll(UserUpdateModal, { item: { UserId: 'u1', UserName: 'alice' }, callback: () => {} });
    await flushAll();

    await wrapper.find('[data-testid="user-update-phone-num"]').setValue('13800138000');
    await wrapper.find('[data-testid="user-update-submit"]').trigger('submit');
    await flushAll();

    const updated = ramCalls.find((c) => c.method === 'updateUser');
    expect(updated.args[0].NewMobilePhone).toBe('86-13800138000');
  });
});