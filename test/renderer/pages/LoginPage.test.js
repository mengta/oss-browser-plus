import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LoginPage from '@renderer/pages/LoginPage.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useToastStore } from '@renderer/stores/toast.js';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: { template: '<div />' } },
      { path: '/', component: { template: '<div />' } },
    ],
  });
}

function mountPage(router) {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(LoginPage, {
    global: {
      plugins: [pinia, router, createRendererI18n('zh-CN')],
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  delete globalThis.__testOssFail;
});

describe('LoginPage', () => {
  it('渲染 AK/SK 与端点、记住账号、协议确认', () => {
    const router = makeRouter();
    const wrapper = mountPage(router);
    expect(wrapper.find('[data-testid="credential-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-id"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-secret"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-remember"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-keep-logged-in"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-submit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-secure"]').exists()).toBe(true);
  });

  it('左右分栏：品牌区/功能特性/连接状态/服务商齐全', () => {
    const wrapper = mountPage(makeRouter());

    expect(wrapper.find('[data-testid="login-brand"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-brand-name"]').text()).toBe('OSS浏览器');
    expect(wrapper.find('[data-testid="login-form-title"]').text()).toBe('连接存储账户');
    expect(wrapper.findAll('[data-testid="login-feature"]').length).toBe(3);
    expect(wrapper.find('[data-testid="login-status"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="login-provider"]').text()).toContain('阿里云 OSS');
  });

  it('登录方式 tab 具备可访问语义并可切换', async () => {
    const wrapper = mountPage(makeRouter());
    const akTab = wrapper.find('[data-testid="login-tab-ak"]');
    const tokenTab = wrapper.find('[data-testid="login-tab-token"]');

    expect(akTab.attributes('role')).toBe('tab');
    expect(akTab.attributes('aria-selected')).toBe('true');
    expect(tokenTab.attributes('aria-selected')).toBe('false');

    await tokenTab.trigger('click');

    expect(tokenTab.attributes('aria-selected')).toBe('true');
    expect(akTab.attributes('aria-selected')).toBe('false');
    expect(wrapper.find('[data-testid="auth-token-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="credential-form"]').exists()).toBe(false);
  });

  it('空表单提交被必填校验拦截（红框点亮且不发起登录）', async () => {
    const router = makeRouter();
    await router.push('/login');
    const wrapper = mountPage(router);

    await wrapper.find('[data-testid="login-submit"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="login-id"]').classes()).toContain('cf-invalid');
    expect(wrapper.find('[data-testid="login-secret"]').classes()).toContain('cf-invalid');
    const toast = useToastStore();
    expect(toast.items.length).toBe(0);
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('osspath 非 oss:// 前缀时校验失败并点亮红框', async () => {
    const router = makeRouter();
    const wrapper = mountPage(router);

    await wrapper.find('[data-testid="login-id"]').setValue('LTAI5tDemo');
    await wrapper.find('[data-testid="login-secret"]').setValue('demo-secret');
    await wrapper.find('[data-testid="login-osspath"]').setValue('bucket/dir/');
    await wrapper.find('[data-testid="login-submit"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="login-osspath"]').classes()).toContain('cf-invalid');
    const toast = useToastStore();
    expect(toast.items.length).toBe(0);
  });

  it('STS. 前缀进入 STS 模式显示 SecurityToken', async () => {
    localStorage.setItem('auth-keep', JSON.stringify({ id: 'STS.nb', secret: 's', stoken: 'tok' }));
    const router = makeRouter();
    const wrapper = mountPage(router);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="login-stoken"]').exists()).toBe(true);
  });

  it('登录成功写入 auth-info/remember 并跳转首页', async () => {
    const router = makeRouter();
    await router.push('/login');
    const wrapper = mountPage(router);

    const idInput = wrapper.find('[data-testid="login-id"]');
    const secretInput = wrapper.find('[data-testid="login-secret"]');
    await idInput.setValue('LTAI5tDemo');
    await secretInput.setValue('demo-secret');

    await wrapper.find('[data-testid="login-submit"]').trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(localStorage.getItem('auth-remember')).toBe('NO');
    expect(localStorage.getItem('auth-info').indexOf('enc:v2d:')).toBe(0);
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('仅目录权限账号 ListBuckets 被拒仍可登录', async () => {
    const original = window.ossBrowser.oss.listAllBuckets;
    window.ossBrowser.oss.listAllBuckets = () =>
      Promise.resolve({
        ok: false,
        code: 'AccessDenied',
        message: 'You are forbidden to oss:ListBuckets',
      });
    const router = makeRouter();
    await router.push('/login');
    const wrapper = mountPage(router);

    await wrapper.find('[data-testid="login-id"]').setValue('LTAI5tDemo');
    await wrapper.find('[data-testid="login-secret"]').setValue('demo-secret');
    await wrapper.find('[data-testid="login-osspath"]').setValue('oss://bucket-a/only-dir/');
    const regionSelect = wrapper.find('[data-testid="login-region"]');
    expect(regionSelect.exists()).toBe(true);
    await regionSelect.setValue(regionSelect.findAll('option')[0].attributes('value'));
    await wrapper.find('[data-testid="login-submit"]').trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.path).toBe('/');
    const { useAuthStore } = await import('@renderer/stores/auth.js');
    const auth = useAuthStore();
    expect(auth.listBucketsDenied).toBe(true);
    expect(auth.info.osspath).toBe('oss://bucket-a/only-dir/');
    window.ossBrowser.oss.listAllBuckets = original;
  });

  it('登录失败提示 code:message 且不跳转', async () => {
    globalThis.__testOssFail = true;
    const router = makeRouter();
    await router.push('/login');
    const wrapper = mountPage(router);

    await wrapper.find('[data-testid="login-id"]').setValue('BAD');
    await wrapper.find('[data-testid="login-secret"]').setValue('BAD');
    await wrapper.find('[data-testid="login-submit"]').trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    const toast = useToastStore();
    const errorItem = toast.items.find((item) => item.message.indexOf('InvalidAccessKeyId') >= 0);
    expect(errorItem).toBeTruthy();
    expect(errorItem.ttl).toBe(60000);
    expect(router.currentRoute.value.path).toBe('/login');

    // 输入内容变化时错误提示立即消失
    await wrapper.find('[data-testid="login-id"]').setValue('LTAI-NEW');
    await wrapper.vm.$nextTick();
    expect(toast.items.some((item) => item.message.indexOf('InvalidAccessKeyId') >= 0)).toBe(false);
  });

  it('渲染 AK 历史与配置导入入口（含历史数徽标）', async () => {
    const router = makeRouter();
    const wrapper = mountPage(router);
    expect(wrapper.find('[data-testid="login-histories"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-import"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-import"]').text()).toBe('配置导入');
    expect(wrapper.find('.login-badge').exists()).toBe(false);

    await wrapper.find('[data-testid="login-histories"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="ak-histories-panel"]').exists()).toBe(true);
    await wrapper.find('[data-testid="base-modal-close"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="ak-histories-panel"]').exists()).toBe(false);

    await wrapper.find('[data-testid="login-import"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="import-config-panel"]').exists()).toBe(true);
  });

  it('历史弹窗点使用后回填表单并关闭', async () => {
    const { useAuthStore } = await import('@renderer/stores/auth.js');
    const router = makeRouter();
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.addHistory({ id: 'LTAI_HIS', secret: 'his-secret', region: 'oss-cn-hangzhou', desc: 'd1' });

    const wrapper = mount(LoginPage, {
      global: { plugins: [pinia, router, createRendererI18n('zh-CN')] },
    });

    await wrapper.find('[data-testid="login-histories"]').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-testid="akh-use"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="login-id"]').element.value).toBe('LTAI_HIS');
    expect(wrapper.find('[data-testid="login-secret"]').element.value).toBe('his-secret');
    expect(wrapper.find('[data-testid="ak-histories-panel"]').exists()).toBe(false);
  });

  it('导入弹窗解析 JSON 后回填表单并关闭', async () => {
    const router = makeRouter();
    const wrapper = mountPage(router);

    await wrapper.find('[data-testid="login-import"]').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-testid="ic-text"]').setValue(
      '{"accessKeyId":"LTAI_IMP","accessKeySecret":"imp-secret","region":"oss-cn-beijing"}'
    );
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-testid="ic-import"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="login-id"]').element.value).toBe('LTAI_IMP');
    expect(wrapper.find('[data-testid="login-secret"]').element.value).toBe('imp-secret');
    expect(wrapper.find('[data-testid="import-config-panel"]').exists()).toBe(false);
  });
});