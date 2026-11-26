import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomePage from '@renderer/pages/HomePage.vue';

describe('HomePage 过渡占位', () => {
  it('渲染空占位容器（B3 已由 FilesPage 承载业务）', () => {
    const wrapper = mount(HomePage);

    const root = wrapper.find('[data-testid="vue-home-page"]');
    expect(root.exists()).toBe(true);
    expect(root.text()).toBe('');
    expect(wrapper.html()).toContain('class="vue-home-page"');
  });
});