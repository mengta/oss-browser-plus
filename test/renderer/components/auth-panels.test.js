import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AkHistoriesPanel from '@renderer/components/business/auth/AkHistoriesPanel.vue';
import ImportConfigPanel from '@renderer/components/business/auth/ImportConfigPanel.vue';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useToastStore } from '@renderer/stores/toast.js';
import { createRendererI18n } from '@renderer/i18n/index.js';
import * as SecureStore from '@renderer/services/secure-store.js';

function mountWith(pinia, component) {
  return mount(component, {
    global: { plugins: [pinia, createRendererI18n('zh-CN')] },
  });
}

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  globalThis.__testSafeStorage = true;
  delete globalThis.__testOssFail;
});

describe('AkHistoriesPanel', () => {
  function setUp(pinia, histories) {
    setActivePinia(pinia);
    const auth = useAuthStore();
    (histories || []).forEach((item) => auth.addHistory(item));
    return auth;
  }

  it('渲染历史、搜索过滤、显示密钥、使用后关闭', async () => {
    const pinia = createPinia();
    setUp(pinia, [
      { id: 'LTAI_A', secret: 'secret-a', region: 'oss-cn-hangzhou' },
      { id: 'LTAI_B', secret: 'secret-b', region: 'oss-cn-beijing' },
    ]);

    const wrapper = mountWith(pinia, AkHistoriesPanel);
    expect(wrapper.findAll('[data-testid="akh-item"]').length).toBe(2);

    await wrapper.find('[data-testid="akh-search"]').setValue('LTAI_B');
    expect(wrapper.findAll('[data-testid="akh-item"]').length).toBe(1);

    const secretBefore = wrapper.find('.akh-secret').text();
    expect(secretBefore.indexOf('****')).toBeGreaterThan(-1);
    await wrapper.find('[data-testid="akh-toggle"]').trigger('click');
    expect(wrapper.find('.akh-secret').text()).toBe('secret-b');
    await wrapper.find('[data-testid="akh-toggle"]').trigger('click');
    expect(wrapper.find('.akh-secret').text().indexOf('****')).toBeGreaterThan(-1);

    await wrapper.find('[data-testid="akh-use"]').trigger('click');
    expect(wrapper.emitted('use')[0][0].id).toBe('LTAI_B');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('regionText：无 region 为 "-"，命中翻译取译文，未命中取原文', async () => {
    const pinia = createPinia();
    setUp(pinia, [
      { id: 'A', secret: 's' },
      { id: 'B', secret: 's', region: 'oss-cn-hangzhou' },
      { id: 'C', secret: 's', region: 'oss-cn-unknown' },
    ]);
    const wrapper = mountWith(pinia, AkHistoriesPanel);
    const byId = {};
    wrapper.findAll('[data-testid="akh-item"]').forEach((row) => {
      byId[row.find('.akh-id').text()] = row.find('.akh-region').text();
    });
    expect(byId.A).toBe('-');
    expect(byId.B).toBe('华东1(杭州)');
    expect(byId.C).toBe('oss-cn-unknown');
  });

  it('删除需确认：取消不删除，确认后删除', async () => {
    const pinia = createPinia();
    const auth = setUp(pinia, [{ id: 'ak1', secret: 's' }, { id: 'ak2', secret: 's' }]);
    const wrapper = mountWith(pinia, AkHistoriesPanel);

    const removeBtn = wrapper.findAll('[data-testid="akh-remove"]')[0];
    await removeBtn.trigger('click');
    expect(wrapper.find('[data-testid="base-modal"]').exists()).toBe(true);

    await wrapper.find('[data-testid="akh-confirm-cancel"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(auth.listHistories().length).toBe(2);
    expect(wrapper.findAll('[data-testid="akh-item"]').length).toBe(2);

    await wrapper.findAll('[data-testid="akh-remove"]')[0].trigger('click');
    await wrapper.find('[data-testid="akh-confirm-ok"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(auth.listHistories().length).toBe(1);
    expect(auth.listHistories()[0].id).toBe('ak1');
    expect(wrapper.findAll('[data-testid="akh-item"]').length).toBe(1);
  });

  it('清空全部需确认：确认后清空并 Toast 成功', async () => {
    const pinia = createPinia();
    const auth = setUp(pinia, [{ id: 'ak1', secret: 's' }, { id: 'ak2', secret: 's' }]);
    const toast = useToastStore();
    const wrapper = mountWith(pinia, AkHistoriesPanel);

    await wrapper.find('[data-testid="akh-cleanall"]').trigger('click');
    await wrapper.find('[data-testid="akh-confirm-ok"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(auth.listHistories()).toEqual([]);
    expect(wrapper.findAll('[data-testid="akh-item"]').length).toBe(0);
    expect(toast.items.some((item) => item.type === 'success')).toBe(true);
  });

  it('非数组历史数据回退为空列表（数组守卫）', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    localStorage.setItem('auth-his', 'not-json-array');
    const wrapper = mountWith(pinia, AkHistoriesPanel);
    expect(wrapper.findAll('[data-testid="akh-item"]').length).toBe(0);
    expect(wrapper.find('[data-testid="akh-cleanall"]').exists()).toBe(true);
  });

  it('历史持久化经 SecureStore v2 加密（密文不含明文 AK）', async () => {
    const pinia = createPinia();
    const auth = setUp(pinia, [{ id: 'ak9', secret: 'sec-9' }]);
    const raw = localStorage.getItem('auth-his');
    expect(raw).toBeTruthy();
    expect(raw.indexOf('ak9')).toBe(-1);
    expect(raw.indexOf('enc:v2:')).toBe(0);
    expect(auth.listHistories().length).toBe(1);
  });
});

describe('ImportConfigPanel', () => {
  it('粘贴 JSON 生成逐字段预览并可导入', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const toast = useToastStore();

    const wrapper = mountWith(pinia, ImportConfigPanel);
    await wrapper.find('[data-testid="ic-text"]').setValue(
      '{"accessKeyId":"LTAI_IMP","accessKeySecret":"imp-secret","region":"oss-cn-hangzhou"}'
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="ic-row-id"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ic-row-secret"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ic-error"]').exists()).toBe(false);

    await wrapper.find('[data-testid="ic-import"]').trigger('click');
    const imported = wrapper.emitted('import')[0][0];
    expect(imported).toEqual({ id: 'LTAI_IMP', secret: 'imp-secret', region: 'oss-cn-hangzhou' });
    expect(toast.items.some((item) => item.type === 'success')).toBe(true);
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('空内容/非法内容显示错误并禁用导入', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mountWith(pinia, ImportConfigPanel);

    await wrapper.find('[data-testid="ic-text"]').setValue('not-a-config');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="ic-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ic-import"]').attributes('disabled')).toBeDefined();
  });
});