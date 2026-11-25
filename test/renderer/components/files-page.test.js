import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import AddressBar from '@renderer/components/business/files/AddressBar.vue';
import ListViewOptions from '@renderer/components/business/files/ListViewOptions.vue';
import FilesPage from '@renderer/pages/FilesPage.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';

// B3-02：文件页骨架与地址栏三组件契约

function installFilesOss(handlers) {
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = {
    listAllBuckets: handlers.listAllBuckets || (() => Promise.resolve({ ok: true, data: [] })),
    listFiles: handlers.listFiles || (() => Promise.resolve({ ok: true, data: { data: [], marker: null } })),
  };
}

function mountWith(wrapperComponent) {
  const i18n = createRendererI18n();
  return mount(wrapperComponent, {
    global: { plugins: [createPinia(), i18n] },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

describe('AddressBar：地址修正与导航', () => {
  it('go() 触发 filesStore.navigate；非法输入补 oss:// 前缀（等价 getAddress）', async () => {
    installFilesOss({});
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('my-bucket/pre/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    const files = useFilesStore();
    expect(files.bucket).toBe('my-bucket');
    expect(files.prefix).toBe('pre/');

    await input.setValue('');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(input.element.value).toBe('oss://');

    await input.setValue('bucket2/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(input.element.value).toBe('oss://bucket2/');
  });

  it('历史栈：后退/前进按钮禁用态与导航（等价 His）', async () => {
    installFilesOss({});
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    const back = wrapper.find('[data-testid="address-back"]');
    const ahead = wrapper.find('[data-testid="address-ahead"]');

    expect(back.attributes('disabled')).toBeDefined();
    expect(ahead.attributes('disabled')).toBeDefined();

    await input.setValue('oss://a1/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    await input.setValue('oss://a1/docs/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(back.attributes('disabled')).toBeUndefined();
    expect(ahead.attributes('disabled')).toBeDefined();

    await back.trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://a1/');
    expect(ahead.attributes('disabled')).toBeUndefined();

    await ahead.trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://a1/docs/');
    expect(ahead.attributes('disabled')).toBeDefined();
  });

  it('goUp：多级回退逐级 pop；根地址时刷新（等价 goUp 语义）', async () => {
    installFilesOss({});
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://b/docs/2024/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    await wrapper.find('[data-testid="address-go-up"]').trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://b/docs/');

    await wrapper.find('[data-testid="address-go-up"]').trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://b/');

    await wrapper.find('[data-testid="address-go-up"]').trigger('click');
    await flushPromises();
    expect(input.element.value).toBe('oss://');
  });

  it('收藏星标 toggle（经 favorites store）', async () => {
    installFilesOss({});
    window.ossBrowser.storage = window.ossBrowser.storage || {
      readFavorites: () => Promise.resolve({ ok: true, data: '[]' }),
      writeFavorites: () => Promise.resolve({ ok: true, data: true }),
    };
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://fav-b/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const favBtn = wrapper.find('[data-testid="address-fav"]');
    expect(favBtn.classes()).not.toContain('active');
    await favBtn.trigger('click');
    await flushPromises();
    expect(favBtn.classes()).toContain('active');

    await favBtn.trigger('click');
    await flushPromises();
    expect(favBtn.classes()).not.toContain('active');
  });

  it('列表内部导航同步地址显示（enterFolder 后 watch filesStore.address）', async () => {
    installFilesOss({
      listFiles: () =>
        Promise.resolve({
          ok: true,
          data: { data: [{ name: 'sub/', path: 'sub/', isFolder: true }], marker: null },
        }),
    });
    const wrapper = mountWith(AddressBar);
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://b/');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const files = useFilesStore();
    await files.enterFolder({ path: 'sub/' });
    await flushPromises();
    expect(input.element.value).toBe('oss://b/sub/');
  });
});

describe('ListViewOptions：视图切换持久化', () => {
  it('点击切换 list/blocks 并写 is-list-view（等价 setListView）', async () => {
    const wrapper = mountWith(ListViewOptions);
    expect(wrapper.find('[data-testid="view-list"]').classes()).toContain('active');
    await wrapper.find('[data-testid="view-blocks"]').trigger('click');
    expect(wrapper.find('[data-testid="view-blocks"]').classes()).toContain('active');
    expect(localStorage.getItem('is-list-view')).toBe('false');
    await wrapper.find('[data-testid="view-list"]').trigger('click');
    expect(localStorage.getItem('is-list-view')).toBe('true');
  });
});

describe('FilesPage：登录态守卫与骨架', () => {
  function mountPage() {
    const i18n = createRendererI18n();
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'files', component: FilesPage },
      ],
    });
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(FilesPage, {
      global: { plugins: [pinia, router, i18n] },
    });
    return { wrapper, router, pinia };
  }

  it('未登录 onMounted 跳 /login（无全局守卫，页面内判定）', async () => {
    const auth = useAuthStore();
    auth.info = null;
    const { router } = mountPage();
    await flushPromises();
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('已登录且有 osspath：进入会话按授权地址导航（无上一账号残留）', async () => {
    installFilesOss({
      listFiles: () =>
        Promise.resolve({
          ok: true,
          data: { data: [{ name: 'f.txt', path: 'f.txt', isFile: true }], marker: null },
        }),
    });
    const { wrapper, pinia } = mountPage();
    const auth = useAuthStore();
    auth.info = { id: 'LTAI', secret: 'sk', osspath: 'oss://granted-b/root/' };
    await flushPromises();
    const files = useFilesStore();
    expect(files.bucket).toBe('granted-b');
    expect(files.prefix).toBe('root/');
    expect(wrapper.find('[data-testid="files-page"]').exists()).toBe(true);
  });
});