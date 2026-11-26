import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BottomLoader from '@renderer/components/business/base/BottomLoader.vue';

describe('BottomLoader', () => {
  it('未处于加载态时不渲染加载文案', () => {
    vi.useFakeTimers();
    const wrapper = mount(BottomLoader, { props: { text: '正在加载更多...' } });
    expect(wrapper.find('.loading-more').exists()).toBe(false);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('加载态渲染加载文案', () => {
    vi.useFakeTimers();
    const wrapper = mount(BottomLoader, { props: { loading: true, text: '正在加载更多...' } });
    expect(wrapper.find('.loading-more').text()).toBe('正在加载更多...');
    wrapper.unmount();
    vi.useRealTimers();
  });
});