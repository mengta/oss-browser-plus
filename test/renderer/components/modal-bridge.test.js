import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { installModalBridge } from '@renderer/bridge/modal-bridge.js';
import ModalHost from '@renderer/components/base/ModalHost.vue';
import * as SecureStore from '@renderer/services/secure-store.js';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('auth-info', JSON.stringify({ id: 'LTAI1', secret: 's1' }));
  SecureStore.resetDekCache();
  setActivePinia(createPinia());
  delete window.vueModalHost;
  delete window.vueModalAngularHost;
  if (document.body) {
    document.body.classList.remove('vue-modal-open');
  }
});

describe('modal-bridge（BRIDGE-B2）', () => {
  it('installModalBridge 挂载 window.vueModalHost 且 open/close 返回 Promise 语义', async () => {
    const ui = useUiStore();
    installModalBridge(getActivePinia());

    expect(typeof window.vueModalHost.open).toBe('function');
    const p = window.vueModalHost.open('settings');
    expect(ui.isOpen('settings')).toBe(true);
    window.vueModalHost.close('settings', 'done');
    await expect(p).resolves.toBe('done');
  });

  it('同名重复打开立即 resolve null（不叠加）', async () => {
    installModalBridge(getActivePinia());
    const p1 = window.vueModalHost.open('settings');
    const p2 = window.vueModalHost.open('settings');
    expect(await p2).toBe(null);
    window.vueModalHost.close('settings', null);
    await expect(p1).resolves.toBe(null);
  });

  it('ModalHost 栈非空时 body.vue-modal-open 点亮，关闭后移除', async () => {
    installModalBridge(getActivePinia());
    const ui = useUiStore();
    const host = mount(ModalHost, {
      global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
    });
    await nextTick();

    window.vueModalHost.open('settings');
    await nextTick();
    expect(document.body.classList.contains('vue-modal-open')).toBe(true);
    expect(host.find('[data-testid="settings-modal"]').exists()).toBe(true);

    window.vueModalHost.close('settings', null);
    await nextTick();
    expect(document.body.classList.contains('vue-modal-open')).toBe(false);
  });

  it('Angular 广播转发器：收藏跳转 goToOssAddress', async () => {
    const broadcasts = [];
    installModalBridge(getActivePinia());
    window.vueModalAngularHost = {
      broadcast: (event, data) => broadcasts.push({ event, data }),
    };
    // 提供收藏数据（storage 桥），否则列表为空无跳转入口
    window.ossBrowser.storage = {
      readFavorites: () => Promise.resolve({ ok: true, data: JSON.stringify([{ url: 'oss://b/x/', time: 1735660800000 }]) }),
      writeFavorites: () => Promise.resolve({ ok: true, data: true }),
    };
    const ui = useUiStore();
    const host = mount(ModalHost, {
      global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
    });
    await nextTick();

    window.vueModalHost.open('fav-list');
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
    await nextTick();
    await host.find('[data-testid="fav-url"]').trigger('click');
    await nextTick();

    expect(broadcasts).toEqual([{ event: 'goToOssAddress', data: 'oss://b/x/' }]);
    expect(ui.depth).toBe(0);
  });

  it('未注册 name 不经桥渲染（保持 $uibModal 原路径的调用方约定）', async () => {
    installModalBridge(getActivePinia());
    const ui = useUiStore();
    const host = mount(ModalHost, {
      global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
    });
    await nextTick();

    window.vueModalHost.open('delete-files-modal');
    await nextTick();
    // 栈内有记录，但 registry 未注册 → ModalHost 不渲染任何业务组件
    expect(ui.depth).toBe(1);
    expect(host.find('[data-testid="settings-modal"]').exists()).toBe(false);
    expect(host.find('[data-testid="users-modal"]').exists()).toBe(false);
    ui.close('delete-files-modal', null);
  });
});