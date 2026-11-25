import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { useUiStore } from '@renderer/stores/ui.js';
import { createRendererI18n } from '@renderer/i18n/index.js';
import ModalHost from '@renderer/components/base/ModalHost.vue';

function mountHost() {
  return mount(ModalHost, {
    global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('ui store dialog 语义（等价 Dialog.confirm/alert）', () => {
  it('confirm：确定 resolve true', async () => {
    const ui = useUiStore();
    const p = ui.confirm('标题', '内容');
    expect(ui.depth).toBe(1);
    const name = ui.stack[0].name;
    ui.close(name, true);
    await expect(p).resolves.toBe(true);
  });

  it('confirm：取消 resolve false', async () => {
    const ui = useUiStore();
    const p = ui.confirm('标题', '内容');
    const name = ui.stack[0].name;
    ui.close(name, false);
    await expect(p).resolves.toBe(false);
  });

  it('alert：仅确定路径 resolve true', async () => {
    const ui = useUiStore();
    const p = ui.alert('提示', '内容');
    ui.close(ui.stack[0].name, true);
    await expect(p).resolves.toBe(true);
  });

  it('并发对话框：不同 name 可并存，closeAll 全部 resolve', async () => {
    const ui = useUiStore();
    const p1 = ui.confirm('a', '1');
    const p2 = ui.confirm('b', '2');
    expect(ui.depth).toBe(2);
    ui.closeAll(false);
    await expect(p1).resolves.toBe(false);
    await expect(p2).resolves.toBe(false);
  });
});

describe('ModalHost + ConfirmDialog 渲染', () => {
  it('confirm 渲染确定/取消按钮，点击分别 resolve true/false', async () => {
    const ui = useUiStore();
    const wrapper = mountHost();
    const p = ui.confirm('删除确认', '确定删除该对象？', { cls: 'danger' });
    await nextTick();

    const okBtn = wrapper.find('[data-testid="dialog-ok"]');
    const cancelBtn = wrapper.find('[data-testid="dialog-cancel"]');
    expect(okBtn.exists()).toBe(true);
    expect(cancelBtn.exists()).toBe(true);
    expect(okBtn.text()).toBe('确定');
    expect(cancelBtn.text()).toBe('取消');
    expect(wrapper.find('.base-modal-title').text()).toBe('删除确认');

    await okBtn.trigger('click');
    await expect(p).resolves.toBe(true);
    await nextTick();
    expect(ui.depth).toBe(0);
    expect(wrapper.find('[data-testid="dialog-ok"]').exists()).toBe(false);
  });

  it('alert 不渲染取消按钮', async () => {
    const ui = useUiStore();
    const wrapper = mountHost();
    const p = ui.alert('提示', '操作已完成');
    await nextTick();

    expect(wrapper.find('[data-testid="dialog-ok"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dialog-cancel"]').exists()).toBe(false);

    ui.close(ui.stack[0].name, false);
    await expect(p).resolves.toBe(false);
  });

  it('cls 主题映射到确定按钮样式', async () => {
    const ui = useUiStore();
    const wrapper = mountHost();
    ui.confirm('删除', '确认？', { cls: 'danger' });
    await nextTick();
    expect(wrapper.find('[data-testid="dialog-ok"]').classes().some((c) => c.indexOf('danger') >= 0)).toBe(true);
    ui.closeAll(false);
  });
});