import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SubAddressBar from '@renderer/components/business/files/SubAddressBar.vue';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';

let pinia;
let navigate;

function mountBar(defAddr = 'oss://bucket-a/') {
  pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().info = { id: 'u1', secret: 's1', osspath: defAddr };
  navigate = vi.spyOn(useFilesStore(), 'navigate').mockResolvedValue(undefined);
  return mount(SubAddressBar, { global: { plugins: [pinia] } });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('SubAddressBar 初始化', () => {
  it('挂载后相对路径归一为 /，前进后退按钮禁用', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/');
    expect(wrapper.find('[data-testid="sub-address-back"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="sub-address-ahead"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="sub-address-go-up"]').attributes('disabled')).toBeUndefined();
  });

  it('setAddress 暴露方法：授权根路径内截取相对段', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    wrapper.vm.setAddress('oss://bucket-a/dir/sub/');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/dir/sub/');
  });

  it('setAddress 对根路径之外的地址补前导斜杠', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    wrapper.vm.setAddress('other-prefix/x');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/other-prefix/x');
  });
});

describe('SubAddressBar 路径提交', () => {
  it('提交相对路径时拼接授权根路径并导航', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    await wrapper.find('[data-testid="sub-address-input"]').setValue('folder/');
    await wrapper.find('form').trigger('submit');

    expect(navigate).toHaveBeenCalledWith('oss://bucket-a/folder/');
    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/folder/');
  });

  it('提交不带前导斜杠的输入会自动补斜杠', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    await wrapper.find('[data-testid="sub-address-input"]').setValue('dir/leaf');
    await wrapper.find('form').trigger('submit');

    expect(navigate).toHaveBeenCalledWith('oss://bucket-a/dir/leaf');
    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/dir/leaf');
  });

  it('提交空输入回退到根相对路径', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    await wrapper.find('[data-testid="sub-address-input"]').setValue('');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/');
  });
});

describe('SubAddressBar 历史导航', () => {
  it('两次导航后可通过返回/前进切换地址', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    await wrapper.find('[data-testid="sub-address-input"]').setValue('one/');
    await wrapper.find('form').trigger('submit');
    await wrapper.find('[data-testid="sub-address-input"]').setValue('two/');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.find('[data-testid="sub-address-back"]').attributes('disabled')).toBeUndefined();

    await wrapper.find('[data-testid="sub-address-back"]').trigger('click');
    expect(navigate).toHaveBeenLastCalledWith('oss://bucket-a/one/');
    expect(wrapper.find('[data-testid="sub-address-ahead"]').attributes('disabled')).toBeUndefined();

    await wrapper.find('[data-testid="sub-address-ahead"]').trigger('click');
    expect(navigate).toHaveBeenLastCalledWith('oss://bucket-a/two/');
  });

  it('禁用状态下点击返回/前进不导航', async () => {
    const wrapper = mountBar('oss://bucket-a/');

    await wrapper.find('[data-testid="sub-address-back"]').trigger('click');
    await wrapper.find('[data-testid="sub-address-ahead"]').trigger('click');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('重复提交同一地址不重复写入历史', async () => {
    const wrapper = mountBar('oss://bucket-a/');
    const input = wrapper.find('[data-testid="sub-address-input"]');

    await input.setValue('same/');
    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    await wrapper.find('[data-testid="sub-address-back"]').trigger('click');

    // 重复提交仍会导航，但历史只保留一项：返回按钮保持禁用
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate.mock.calls.every(([addr]) => addr === 'oss://bucket-a/same/')).toBe(true);
    expect(wrapper.find('[data-testid="sub-address-back"]').attributes('disabled')).toBeDefined();
  });
});

describe('SubAddressBar 上一级', () => {
  it('从子目录回到父目录', async () => {
    const wrapper = mountBar('oss://bucket-a/');
    wrapper.vm.setAddress('oss://bucket-a/dir/sub/');
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="sub-address-go-up"]').trigger('click');

    expect(navigate).toHaveBeenLastCalledWith('oss://bucket-a/dir/');
    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/dir/');
  });

  it('一级目录回到 oss 根', async () => {
    const wrapper = mountBar('oss://bucket-a/');
    wrapper.vm.setAddress('oss://bucket-a/dir/');
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="sub-address-go-up"]').trigger('click');

    // 授权根路径为 oss://bucket-a/，一级目录上移回到该根路径
    expect(navigate).toHaveBeenLastCalledWith('oss://bucket-a/');
    expect(wrapper.find('[data-testid="sub-address-input"]').element.value).toBe('/');
  });
});