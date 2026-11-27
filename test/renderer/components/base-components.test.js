import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ToastHost from '@renderer/components/base/ToastHost.vue';
import LoadingOverlay from '@renderer/components/base/LoadingOverlay.vue';
import EmptyState from '@renderer/components/base/EmptyState.vue';
import CleanableInput from '@renderer/components/base/CleanableInput.vue';
import CopyButton from '@renderer/components/base/CopyButton.vue';
import TimerText from '@renderer/components/base/TimerText.vue';
import BaseModal from '@renderer/components/base/BaseModal.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useToastStore } from '@renderer/stores/toast.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastHost', () => {
  it('堆叠渲染 store 项并按类型着色', () => {
    const toast = useToastStore();
    toast.push('first', 'danger', 0);
    toast.push('second', 'success', 0);
    const wrapper = mount(ToastHost);
    const items = wrapper.findAll('[data-testid="toast-item"]');
    expect(items.length).toBe(2);
    expect(items[0].text()).toContain('first');
    expect(items[0].classes()).toContain('toast-danger');
    expect(items[1].classes()).toContain('toast-success');
  });

  it('点击/选择文案不会移除提示（允许复制，60s 自动消失）', async () => {
    const toast = useToastStore();
    toast.clear();
    toast.push('copy-me', 'danger', 60000);
    const wrapper = mount(ToastHost);
    const item = wrapper.find('[data-testid="toast-item"]');
    await item.trigger('click');
    expect(toast.items.some((x) => x.message === 'copy-me')).toBe(true);
    expect(toast.items[0].ttl).toBe(60000);
  });
});

describe('LoadingOverlay', () => {
  it('visible 时渲染 8 个 loadEffect 方块，隐藏时不渲染', () => {
    const shown = mount(LoadingOverlay, { props: { visible: true } });
    expect(shown.find('.loadEffect').exists()).toBe(true);
    expect(shown.findAll('.loadEffect span').length).toBe(8);
    const hidden = mount(LoadingOverlay, { props: { visible: false } });
    expect(hidden.find('.loadEffect').exists()).toBe(false);
  });
});

describe('EmptyState', () => {
  it('渲染图标与文案', () => {
    const wrapper = mount(EmptyState, { props: { icon: 'inbox', text: '暂无数据' } });
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.text()).toContain('暂无数据');
  });

  it('未知图标回退占位不抛错', () => {
    const wrapper = mount(EmptyState, { props: { icon: 'no-such-icon', text: 'x' } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});

describe('CleanableInput', () => {
  it('输入 emit 新值，清除按钮随值显隐并清空', async () => {
    const wrapper = mount(CleanableInput, { props: { modelValue: '' } });
    expect(wrapper.find('[data-testid="cleanable-clear"]').exists()).toBe(false);

    await wrapper.find('input').setValue('abc');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['abc']);

    await wrapper.setProps({ modelValue: 'abc' });
    const clearBtn = wrapper.find('[data-testid="cleanable-clear"]');
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger('click');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted[emitted.length - 1]).toEqual(['']);
    expect(wrapper.emitted('clear')).toBeTruthy();
  });

  it('clearable=false 时不渲染清除按钮', async () => {
    const wrapper = mount(CleanableInput, { props: { modelValue: 'abc', clearable: false } });
    expect(wrapper.find('[data-testid="cleanable-clear"]').exists()).toBe(false);
  });
});

describe('CopyButton', () => {
  it('复制成功弹 copy.successfully', async () => {
    const toast = useToastStore();
    const wrapper = mount(CopyButton, {
      props: { text: 'secret-value' },
      global: { plugins: [createRendererI18n('zh-CN')] },
    });
    await wrapper.find('button').trigger('click');
    await Promise.resolve();
    expect(toast.items.some((item) => item.message === 'copy.successfully')).toBe(true);
  });

  it('复制失败不提示成功', async () => {
    const original = window.ossBrowser.system.clipboardWriteText;
    window.ossBrowser.system.clipboardWriteText = () => Promise.resolve({ ok: false, code: 'X', message: 'denied' });
    const toast = useToastStore();
    const wrapper = mount(CopyButton, {
      props: { text: 'abc' },
      global: { plugins: [createRendererI18n('zh-CN')] },
    });
    await wrapper.find('button').trigger('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(toast.items.some((item) => item.message === 'copy.successfully')).toBe(false);
    window.ossBrowser.system.clipboardWriteText = original;
  });
});

describe('TimerText', () => {
  it('每秒刷新且到期停止', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T00:00:00Z'));
    const endTime = Date.now() + 3000;
    const wrapper = mount(TimerText, { props: { endTime } });
    expect(wrapper.text()).toContain('3s');

    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.text()).toContain('2s');

    await vi.advanceTimersByTimeAsync(2000);
    const expired = wrapper.text();
    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.text()).toBe(expired);
  });
});

describe('BaseModal', () => {
  it('遮罩、Esc、关闭按钮三路径均 emit close', async () => {
    const wrapper = mount(BaseModal, { props: { title: 'T', result: 'r' }, attachTo: document.body });
    await wrapper.find('[data-testid="base-modal-mask"]').trigger('click');
    expect(wrapper.emitted('close')[0]).toEqual(['r']);

    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('close').length).toBeGreaterThanOrEqual(2);

    await wrapper.find('[data-testid="base-modal-close"]').trigger('click');
    expect(wrapper.emitted('close').length).toBeGreaterThanOrEqual(3);

    wrapper.unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
});