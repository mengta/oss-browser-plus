import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppIcon from '@renderer/components/base/AppIcon.vue';
import { ICON_PATHS, AUTH_ICON_NAMES, getIconPath, hasIcon, FALLBACK_PATH } from '@renderer/icons/registry.js';

describe('icon registry', () => {
  it('首批图标覆盖登录页全部使用点', () => {
    expect(AUTH_ICON_NAMES.length).toBe(10);
    for (const name of AUTH_ICON_NAMES) {
      expect(hasIcon(name)).toBe(true);
      expect(typeof ICON_PATHS[name]).toBe('string');
    }
  });

  it('未知 name 回退占位路径', () => {
    expect(getIconPath('not-exists')).toBe(FALLBACK_PATH);
    expect(hasIcon('not-exists')).toBe(false);
  });
});

describe('AppIcon', () => {
  it('按 name 渲染内联 SVG path', () => {
    const wrapper = mount(AppIcon, { props: { name: 'search' } });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('viewBox')).toBe('0 0 24 24');
    expect(wrapper.find('path').attributes('d')).toBe(ICON_PATHS.search);
  });

  it('尺寸透传（数字与字符串）', () => {
    const small = mount(AppIcon, { props: { name: 'eye', size: 24 } });
    expect(small.find('svg').attributes('width')).toBe('24');
    const large = mount(AppIcon, { props: { name: 'eye', size: '32' } });
    expect(large.find('svg').attributes('height')).toBe('32');
  });

  it('class 透传且颜色随 currentColor', () => {
    const wrapper = mount(AppIcon, { props: { name: 'check', iconClass: 'text-success' } });
    expect(wrapper.find('svg').classes()).toContain('text-success');
    expect(wrapper.find('path').attributes('fill')).toBe('currentColor');
  });

  it('未知 name 不抛错并渲染占位', () => {
    const wrapper = mount(AppIcon, { props: { name: 'unknown-icon' } });
    expect(wrapper.find('path').attributes('d')).toBe(FALLBACK_PATH);
  });
});