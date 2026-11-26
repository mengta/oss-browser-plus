import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

import CommandPalette from '@renderer/components/base/CommandPalette.vue';
import FileToolbar from '@renderer/components/business/files/FileToolbar.vue';
import AddressBar from '@renderer/components/business/files/AddressBar.vue';
import App from '@renderer/App.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useFavoritesStore } from '@renderer/stores/favorites.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useFilesStore } from '@renderer/stores/files.js';

// B5-UI 二期：活动栏 / 命令面板 / 工具栏图标化

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
    ],
  });
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, router, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('CommandPalette：Ctrl+Shift+P 命令面板', () => {
  function openPalette(wrapper) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }));
    return flushPromises();
  }

  it('快捷键打开、过滤、Enter 执行并关闭', async () => {
    const run = vi.fn();
    const wrapper = mountWith(CommandPalette, {
      commands: [
        { id: 'refresh', label: '刷新列表', icon: 'refresh', run },
        { id: 'settings', label: '设置', icon: 'cog', run: vi.fn() },
      ],
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(false);

    await openPalette(wrapper);
    expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(true);
    expect(wrapper.findAll('.cp-item').length).toBe(2);

    await wrapper.find('[data-testid="command-input"]').setValue('刷新');
    await flushPromises();
    expect(wrapper.findAll('.cp-item').length).toBe(1);

    await wrapper.find('[data-testid="command-input"]').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(run).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(false);
  });

  it('Esc 关闭；空命令不打开', async () => {
    const empty = mountWith(CommandPalette, { commands: [] });
    await openPalette(empty);
    expect(empty.find('[data-testid="command-palette"]').exists()).toBe(false);

    const wrapper = mountWith(CommandPalette, { commands: [{ id: 'a', label: 'A', run: () => {} }] });
    await openPalette(wrapper);
    await wrapper.find('[data-testid="command-input"]').trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(false);
  });
});

describe('FileToolbar：图标化', () => {
  it('上传/下载等按钮含内联 SVG 图标（文本保留）', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'LTAI-test', secret: 'sk' };
    useFilesStore(pinia).bucket = 'b';
    const wrapper = mountWith(FileToolbar);
    await flushPromises();
    expect(wrapper.find('[data-testid="file-upload"] svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="file-download"] svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="file-mkdir"] svg').exists()).toBe(true);
  });
});
describe('App：命令面板接入', () => {
  it('登录态启用 Ctrl+Shift+P', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'LTAI-test', secret: 'sk' };
    const wrapper = mountWith(App);
    await flushPromises();
    await flushPromises();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true })
    );
    await flushPromises();
    expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(true);
    expect(wrapper.findAll('.cp-item').length).toBeGreaterThan(5);
    expect(wrapper.find('[data-testid="command-transfer-open"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="command-theme-system"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="command-theme-pick"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="command-rename-selected"]').exists()).toBe(false);

    await wrapper.find('[data-testid="command-input"]').trigger('keydown', { key: 'Escape' });
    await flushPromises();

    const filesNow = useFilesStore(pinia);
    filesNow.selectedList = [{ name: 'a.txt', path: 'pre/a.txt', isFile: true }];
    filesNow.items = [filesNow.selectedList[0]];
    await flushPromises();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true })
    );
    await flushPromises();
    const renameBtn = wrapper.find('[data-testid="command-rename-selected"]');
    expect(renameBtn.exists()).toBe(true);
    expect(wrapper.find('[data-testid="command-delete-selected"]').exists()).toBe(true);

    const uiNow = useUiStore(pinia);
    const openSpy = vi.spyOn(uiNow, 'open').mockResolvedValue(null);
    await renameBtn.trigger('click');
    expect(openSpy).toHaveBeenCalledWith(
      'rename',
      expect.objectContaining({ item: filesNow.selectedList[0] })
    );
  });
});
describe('主题切换（Dark+/Light+）', () => {
  it('ui.setTheme 应用到 html[data-theme] 并持久化', () => {
    const ui = useUiStore();
    ui.setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('vsc-theme')).toBe('light');

    ui.setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('vsc-theme')).toBe('dark');
  });
});

describe('AddressBar：面包屑导航', () => {
  it('分段展示并可点击跳转；聚焦进入编辑态', async () => {
    const pinia = getActivePinia();
    const files = useFilesStore(pinia);
    const wrapper = mountWith(AddressBar);
    await flushPromises();
    const navSpy = vi.spyOn(files, 'navigate').mockResolvedValue();
    const input = wrapper.find('[data-testid="address-input"]');
    await input.setValue('oss://demo/pre/sub/');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="address-crumbs"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="crumb-root"]').text()).toBe('oss://');
    expect(wrapper.find('[data-testid="crumb-bucket"]').text()).toBe('demo');
    expect(wrapper.find('[data-testid="crumb-1"]').text()).toBe('sub');

    await wrapper.find('[data-testid="crumb-bucket"]').trigger('click');
    expect(navSpy).toHaveBeenCalledWith('oss://demo/');

    await wrapper.find('[data-testid="address-input"]').trigger('focus');
    expect(wrapper.find('[data-testid="address-input"]').classes()).toContain('editing');
  });

  it('挂载时预热收藏并高亮当前目录（尾斜杠差异不影响）', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'LTAI-test', secret: 'sk', osspath: 'oss://demo/pre' };
    const favorites = useFavoritesStore(pinia);
    const warmSpy = vi.spyOn(favorites, 'warm').mockResolvedValue([]);
    favorites.items = [{ url: 'oss://demo/pre/', time: 1 }];

    const wrapper = mountWith(AddressBar);
    await flushPromises();

    expect(warmSpy).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="address-fav"]').classes()).toContain('active');
    expect(wrapper.find('[data-testid="address-fav"] .app-icon').attributes('aria-label')).toBe('star-filled');
  });
});

describe('主题：跟随系统', () => {
  it('system 模式解析 prefers-color-scheme 并持久化 mode', () => {
    const ui = useUiStore();
    const original = window.matchMedia;
    window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    ui.setTheme('system');
    expect(ui.themeMode).toBe('system');
    expect(ui.theme).toBe('light');

    window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    ui.setTheme('system');
    expect(ui.theme).toBe('dark');

    window.matchMedia = original;
    ui.setTheme('dark');
  });
});
