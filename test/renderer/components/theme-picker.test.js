import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import ThemePicker from '@renderer/components/base/ThemePicker.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';

function mountPicker() {
  const pinia = getActivePinia() || createPinia();
  const wrapper = mount(ThemePicker, {
    global: { plugins: [pinia, createRendererI18n('zh-CN')] },
  });
  return { wrapper, ui: useUiStore(pinia) };
}

async function open(wrapper, ui) {
  ui.openThemePicker();
  await flushPromises();
  return wrapper.find('[data-testid="theme-picker"]');
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('ThemePicker：VS Code 颜色主题快速选择', () => {
  it('默认关闭；打开后列出 Dark+/Light+/跟随系统并标记当前主题', async () => {
    const { wrapper, ui } = mountPicker();
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(false);

    await open(wrapper, ui);
    expect(wrapper.find('[data-testid="theme-option-dark"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="theme-option-light"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="theme-option-system"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="theme-option-dark"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.find('[data-testid="theme-option-light"]').text()).toContain('浅色');
  });

  it('点击 Light+ 立即应用、持久化并关闭', async () => {
    const { wrapper, ui } = mountPicker();
    await open(wrapper, ui);

    await wrapper.find('[data-testid="theme-option-light"]').trigger('click');
    await flushPromises();

    expect(ui.themeMode).toBe('light');
    expect(ui.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('vsc-theme')).toBe('light');
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(false);
  });

  it('方向键即时预览，Esc 取消并恢复原主题', async () => {
    const { wrapper, ui } = mountPicker();
    ui.setTheme('dark');
    await open(wrapper, ui);

    const input = wrapper.find('[data-testid="theme-input"]');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(ui.themeMode).toBe('light');

    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(ui.themeMode).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(false);
  });

  it('Enter 确认当前高亮主题', async () => {
    const { wrapper, ui } = mountPicker();
    ui.setTheme('dark');
    await open(wrapper, ui);

    const input = wrapper.find('[data-testid="theme-input"]');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(ui.themeMode).toBe('light');
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(false);
  });

  it('输入过滤主题列表', async () => {
    const { wrapper, ui } = mountPicker();
    await open(wrapper, ui);
    await wrapper.find('[data-testid="theme-input"]').setValue('浅色');

    expect(wrapper.find('[data-testid="theme-option-light"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="theme-option-dark"]').exists()).toBe(false);
  });

  it('Ctrl+K Ctrl+T 打开选择器', async () => {
    const { wrapper, ui } = mountPicker();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }));
    await flushPromises();

    expect(ui.themePickerOpen).toBe(true);
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(true);
  });
});