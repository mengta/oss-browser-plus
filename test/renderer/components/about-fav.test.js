import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useFavoritesStore } from '@renderer/stores/favorites.js';
import { useToastStore } from '@renderer/stores/toast.js';
import AboutModal from '@renderer/components/business/modals/AboutModal.vue';
import FavListModal from '@renderer/components/business/modals/FavListModal.vue';
import * as SecureStore from '@renderer/services/secure-store.js';

function installBootstrapBridge(overrides) {
  globalThis.window = globalThis.window || {};
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.bootstrap = Object.assign(
    {
      get: () => ({
        ok: true,
        data: Object.assign(
          {
            appVersion: '1.20.6',
            logo: 'icons/icon.png',
            aboutHtml: '',
            platform: 'win32',
            arch: 'x64',
            releaseNotesUrl: 'https://notes.example.com/release-notes/',
          },
          overrides || {}
        ),
      }),
    },
    {}
  );
}

function installUpgradeBridge(overrides) {
  window.ossBrowser.upgrade = Object.assign(
    { check: () => Promise.resolve({ ok: true, data: null }), subscribe: () => 'sub-1', uninstall: () => {} },
    overrides || {}
  );
}

function mountAll(component) {
  const wrapper = mount(component, {
    global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
  });
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('auth-info', JSON.stringify({ id: 'LTAI1', secret: 's1' }));
  localStorage.setItem('lang', 'zh-CN');
  SecureStore.resetDekCache();
  setActivePinia(createPinia());
  installBootstrapBridge();
  delete window.showdown;
  delete window.fetch;
  delete window.external;
});

describe('AboutModal（B2-05 关于页）', () => {
  it('标准资产：logo/版本/开源地址展示', async () => {
    const wrapper = mountAll(AboutModal);
    await nextTick();
    await nextTick();

    expect(wrapper.find('[data-testid="about-version"]').text()).toBe('v 1.20.6');
    expect(wrapper.find('[data-testid="about-logo"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="about-custom"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="about-opensource-link"]').exists()).toBe(true);
  });

  it('定制资产：aboutHtml 展示且回退隐藏', async () => {
    installBootstrapBridge({ aboutHtml: '<b>企业定制版</b>' });
    const wrapper = mountAll(AboutModal);
    await nextTick();
    await nextTick();

    expect(wrapper.find('[data-testid="about-custom"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="about-custom"]').html()).toContain('企业定制版');
    expect(wrapper.find('[data-testid="about-opensource-link"]').exists()).toBe(false);
  });

  it('版本升级区已移除：不再展示 new/uptodate，仅保留开源地址', async () => {
    installUpgradeBridge({
      check: () => Promise.resolve({ ok: true, data: { version: '1.21.0', package_url: 'https://pkg.example.com/' } }),
    });
    const wrapper = mountAll(AboutModal);
    await nextTick();
    await nextTick();

    expect(wrapper.find('[data-testid="about-new-version"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="about-download"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="about-no-new"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="about-opensource-link"]').text()).toContain('mengta/oss-browser-plus');
  });

  it('开源地址指向 mengta/oss-browser-plus 并经 openExternal', async () => {
    const opened = [];
    window.ossBrowser.system = { openExternal: (url) => opened.push(url) };
    const wrapper = mountAll(AboutModal);
    await nextTick();
    await nextTick();

    expect(wrapper.find('[data-testid="about-opensource-link"]').text()).toBe('https://github.com/mengta/oss-browser-plus');
    await wrapper.find('[data-testid="about-opensource-link"]').trigger('click');
    expect(opened).toContain('https://github.com/mengta/oss-browser-plus');
  });

  it('关闭按钮 emit close', async () => {
    const wrapper = mountAll(AboutModal);
    await nextTick();
    await nextTick();
    await wrapper.find('[data-testid="about-close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  // P2（R-P2-01/R-P2-02 · V-02）：发行说明必须渲染为 HTML 而非纯文本
  it('发行说明：readReleaseNotes 的 Markdown 渲染为 HTML 标签', async () => {
    window.ossBrowser.system.readReleaseNotes = () =>
      Promise.resolve({ ok: true, data: { found: true, markdown: '# 版本 1.20.6\n\n- 修复列表分页' } });

    const wrapper = mountAll(AboutModal);
    await nextTick();
    await flushMicro();
    await nextTick();

    const body = wrapper.find('[data-testid="about-release-body"]');
    expect(body.exists()).toBe(true);
    expect(body.html()).toContain('<h1');
    expect(body.html()).toContain('<li>');
    const error = wrapper.find('[data-testid="about-release-error"]');
    expect(error.exists()).toBe(false);
  });

  it('发行说明读取失败：展示可关闭的提示条（不静默降级）', async () => {
    window.ossBrowser.system.readReleaseNotes = () =>
      Promise.resolve({ ok: false, code: 'IO', message: 'read failed' });

    const wrapper = mountAll(AboutModal);
    await nextTick();
    await flushMicro();
    await nextTick();

    const error = wrapper.find('[data-testid="about-release-error"]');
    expect(error.exists()).toBe(true);
    expect(wrapper.find('[data-testid="about-release-body"]').exists()).toBe(false);

    await wrapper.find('[data-testid="about-release-error-dismiss"]').trigger('click');
    expect(wrapper.find('[data-testid="about-release-error"]').exists()).toBe(false);
  });
  });

describe('favorites store + FavListModal（B2-06 收藏）', () => {
  it('store：add/has/remove/list 与持久化写入（sha256 命名由桥承担）', async () => {
    const writes = [];
    window.ossBrowser.storage = {
      readFavorites: (username) => {
        expect(username).toBe('LTAI1');
        return Promise.resolve({ ok: true, data: JSON.stringify([{ url: 'oss://seed/', time: 123 }]) });
      },
      writeFavorites: (username, content) => {
        writes.push({ username, content });
        return Promise.resolve({ ok: true, data: true });
      },
    };

    const favorites = useFavoritesStore();
    await favorites.warm();
    expect(favorites.items.length).toBe(1);

    favorites.add('oss://bucket/dir/');
    expect(favorites.has('oss://bucket/dir/')).toBe(true);
    await flushMicro();
    expect(writes.length).toBe(1);
    expect(JSON.parse(writes[0].content).some((item) => item.url === 'oss://bucket/dir/')).toBe(true);

    favorites.remove('oss://seed/');
    await flushMicro();
    expect(favorites.has('oss://seed/')).toBe(false);
    expect(writes.length).toBe(2);
  });

  it('FavListModal：列表/删除提示/跳转 emit', async () => {
    window.ossBrowser.storage = {
      readFavorites: () => Promise.resolve({ ok: true, data: JSON.stringify([{ url: 'oss://b/x/', time: 1735660800000 }]) }),
      writeFavorites: () => Promise.resolve({ ok: true, data: true }),
    };
    const wrapper = mountAll(FavListModal);
    await nextTick();
    await flushMicro();
    await nextTick();

    const rows = wrapper.findAll('[data-testid="fav-row"]');
    expect(rows.length).toBe(1);
    expect(wrapper.find('[data-testid="fav-url"]').text()).toBe('oss://b/x/');

    await wrapper.find('[data-testid="fav-url"]').trigger('click');
    expect(wrapper.emitted('goTo')[0][0]).toBe('oss://b/x/');
    expect(wrapper.emitted('close')).toBeTruthy();

    await wrapper.find('[data-testid="fav-remove"]').trigger('click');
    const toast = useToastStore();
    expect(toast.items.some((item) => item.message === '删除书签成功')).toBe(true);
  });
});

async function flushMicro() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}