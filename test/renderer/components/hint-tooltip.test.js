import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import HintTooltip from '@renderer/components/base/HintTooltip.vue';
import CredentialForm from '@renderer/components/business/auth/CredentialForm.vue';
import AkHistoriesPanel from '@renderer/components/business/auth/AkHistoriesPanel.vue';
import { useAuthStore } from '@renderer/stores/auth.js';
import { createRendererI18n } from '@renderer/i18n/index.js';

// 登录页帮助浮窗（原原生 title 在 Electron 下不弹出 → 自研 HintTooltip）

function mountWith(component, props, plugins) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()].concat(plugins || []) },
  });
}

function waitHide() {
  return new Promise((resolve) => setTimeout(resolve, 220));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('HintTooltip：帮助浮窗', () => {
  it('hover 显示文案，离开隐藏；空文案不显示', async () => {
    const wrapper = mountWith(HintTooltip, { text: '帮助文案' });
    await wrapper.find('.hint-tooltip').trigger('mouseenter');
    await flushPromises();
    const pop = document.querySelector('.hint-pop');
    expect(pop).toBeTruthy();
    expect(pop.textContent.trim()).toBe('帮助文案');

    await wrapper.find('.hint-tooltip').trigger('mouseleave');
    await waitHide();
    await flushPromises();
    expect(document.querySelector('.hint-pop')).toBeFalsy();

    const empty = mountWith(HintTooltip, { text: '' });
    await empty.find('.hint-tooltip').trigger('mouseenter');
    await flushPromises();
    expect(document.querySelector('.hint-pop')).toBeFalsy();
  });

  it('登录页四处帮助图标均渲染浮窗（Endpoint/预设 Path/请求者付费/记住账号）', async () => {
    const wrapper = mountWith(CredentialForm, {
      modelValue: { id: 'LTAI-test', secret: 'sk', osspath: 'oss://demo/' },
    });
    await flushPromises();

    for (const id of [
      'login-eptpl-help',
      'login-osspath-help',
      'login-requestpay-help',
      'login-remember-help',
    ]) {
      expect(wrapper.find('[data-testid="' + id + '"]').exists()).toBe(true);
    }

    const help = wrapper.find('[data-testid="login-eptpl-help"]');
    await help.trigger('mouseenter');
    await flushPromises();
    const pop = document.querySelector('.hint-pop');
    expect(pop).toBeTruthy();
    expect((pop.textContent || '').length).toBeGreaterThan(0);

    await help.trigger('mouseleave');
    await new Promise((resolve) => setTimeout(resolve, 320));
    await flushPromises();
    expect(document.querySelectorAll('.hint-pop').length).toBe(0);
  });

  it('支持文档链接：浮窗内 requestPayer 可点击并调用 system.openExternal', async () => {
    const openSpy = vi.spyOn(window.ossBrowser.system, 'openExternal');
    const wrapper = mountWith(HintTooltip, {
      text: '请求者付费说明',
      linkUrl: 'https://help.aliyun.com/document_detail/91337.html',
    });
    await wrapper.find('.hint-tooltip').trigger('mouseenter');
    await flushPromises();
    const link = document.querySelector('[data-testid="hint-link"]');
    expect(link).toBeTruthy();
    link.click();
    expect(openSpy).toHaveBeenCalledWith('https://help.aliyun.com/document_detail/91337.html');
  });

  it('AK 历史含 requestpaystatus=YES 时显示「请求者付费」标签', async () => {
    const pinia = getActivePinia();
    useAuthStore(pinia).addHistory({ id: 'LTAI-test', secret: 'sk', requestpaystatus: 'YES' });
    const wrapper = mountWith(AkHistoriesPanel);
    await flushPromises();
    expect(wrapper.find('[data-testid="akh-requestpay"]').exists()).toBe(true);
  });
});