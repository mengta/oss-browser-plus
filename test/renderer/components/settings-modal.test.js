import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useSettingsStore } from '@renderer/stores/settings.js';
import { useToastStore } from '@renderer/stores/toast.js';
import SettingsModal from '@renderer/components/business/modals/SettingsModal.vue';
import ModalHost from '@renderer/components/base/ModalHost.vue';
import * as SecureStore from '@renderer/services/secure-store.js';

let wrapper = null;
let host = null;

function mountAll() {
  wrapper = mount(SettingsModal, {
    global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
  });
  // 真实场景 App.vue 常驻 ModalHost；测试中同 pinia 挂载以便 ui.confirm 渲染确认框
  host = mount(ModalHost, {
    global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] },
  });
  return wrapper;
}

function installSystemBridge(overrides) {
  globalThis.window = globalThis.window || {};
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.system = Object.assign(
    { refreshPage: () => {}, openDevTools: () => {} },
    overrides || {}
  );
}

async function flushMicro() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  localStorage.clear();
  SecureStore.resetDekCache();
  setActivePinia(createPinia());
  delete globalThis.__testSafeStorage;
  // 保留 setup.js 的 ossBrowser 桥（credentials DEK 加载依赖），仅覆盖 system 方法
  installSystemBridge();
});

describe('SettingsModal（B2-02 设置页主体）', () => {
  it('全部设置项回显默认值', async () => {
    mountAll();
    await nextTick();

    expect(wrapper.find('[data-testid="settings-maxUploadJobCount"]').element.value).toBe('3');
    expect(wrapper.find('[data-testid="settings-maxDownloadJobCount"]').element.value).toBe('1');
    expect(wrapper.find('[data-testid="settings-connectTimeout"]').element.value).toBe('60000');
    expect(wrapper.find('[data-testid="settings-uploadPartSize"]').element.value).toBe('10');
    expect(wrapper.find('[data-testid="settings-downloadConcurrecyPartSize"]').element.value).toBe('5');
    expect(wrapper.find('[data-testid="settings-uploadAndDownloadRetryTimes"]').element.value).toBe('5');
    expect(wrapper.find('[data-testid="settings-listObjectNum"]').element.value).toBe('500');
    expect(wrapper.find('[data-testid="settings-autoUpgrade"] input').element.checked).toBe(true);
    expect(wrapper.find('[data-testid="settings-showImageSnapshot"] input').element.checked).toBe(true);
    expect(wrapper.find('[data-testid="settings-logFile"] input').element.checked).toBe(false);
    expect(wrapper.find('[data-testid="settings-logFileInfo"] input').element.checked).toBe(false);
    expect(wrapper.find('[data-testid="settings-language"]').exists()).toBe(true);
  });

  it('修改并发数后 500ms 防抖保存并 Toast 成功', async () => {
    vi.useFakeTimers();
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-maxUploadJobCount"]').setValue(7);
    await wrapper.find('[data-testid="settings-maxUploadJobCount"]').trigger('change');
    await nextTick();

    expect(localStorage.getItem('maxUploadJobCount')).toBe(null);
    vi.advanceTimersByTime(500);
    expect(localStorage.getItem('maxUploadJobCount')).toBe('7');

    const toast = useToastStore();
    expect(toast.items.some((item) => item.message === '已经保存设置')).toBe(true);
  });

  it('越界值（maxUploadJobCount=0）不保存', async () => {
    vi.useFakeTimers();
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-maxUploadJobCount"]').setValue(0);
    await wrapper.find('[data-testid="settings-maxUploadJobCount"]').trigger('change');
    vi.advanceTimersByTime(500);

    expect(localStorage.getItem('maxUploadJobCount')).toBe(null);
    const toast = useToastStore();
    expect(toast.items.some((item) => item.message === '已经保存设置')).toBe(false);
  });

  it('logFile 变更触发 refreshPage', async () => {
    vi.useFakeTimers();
    let refreshCalled = 0;
    installSystemBridge({ refreshPage: () => { refreshCalled += 1; } });
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-logFile"] input').setValue(true);

    vi.advanceTimersByTime(500);

    expect(localStorage.getItem('logFile')).toBe('1');
    expect(refreshCalled).toBe(1);
  });

  it('开发者工具按钮调 openDevTools', async () => {
    let called = 0;
    installSystemBridge({ openDevTools: () => { called += 1; } });
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-open-debug"]').trigger('click');
    expect(called).toBe(1);
  });

  it('语言切换持久化并提示', async () => {
    vi.useFakeTimers();
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-language"]').setValue('en-US');
    await wrapper.find('[data-testid="settings-language"]').trigger('change');

    expect(localStorage.getItem('lang')).toBe('en-US');
  });

  it('关闭按钮 emit close', async () => {
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});

describe('SettingsModal SMTP（B2-03 加密保存与测试邮件）', () => {
  it('SMTP 表单默认值与整体密文保存（无明文密码）', async () => {
    vi.useFakeTimers();
    globalThis.__testSafeStorage = true;
    mountAll();
    await nextTick();

    expect(wrapper.find('[data-testid="settings-smtp-port"]').element.value).toBe('465');

    await wrapper.find('[data-testid="settings-smtp-host"]').setValue('smtp.example.com');
    await wrapper.find('[data-testid="settings-smtp-from"]').setValue('a@example.com');
    await wrapper.find('[data-testid="settings-smtp-user"]').setValue('demo');
    await wrapper.find('[data-testid="settings-smtp-pass"]').setValue('secret-pass');
    await wrapper.find('[data-testid="settings-smtp-host"]').trigger('change');
    vi.advanceTimersByTime(500);

    const raw = localStorage.getItem('mailSender');
    expect(raw.indexOf('enc:v2:')).toBe(0);
    expect(raw.indexOf('smtp.example.com')).toBe(-1);
    expect(raw.indexOf('secret-pass')).toBe(-1);
  });

  it('测试邮件：确认后经 mail 桥发送并成功提示', async () => {
    vi.useFakeTimers();
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-smtp-from"]').setValue('a@example.com');

    let sentInfo = null;
    window.ossBrowser = window.ossBrowser || {};
    window.ossBrowser.mail = {
      send: (smtp, info) => {
        sentInfo = info;
        return Promise.resolve({ ok: true, data: { messageId: 'm1' } });
      },
    };

    await wrapper.find('[data-testid="settings-smtp-test"]').trigger('click');
    await nextTick();

    const okBtn = host.find('[data-testid="dialog-ok"]');
    expect(okBtn.exists()).toBe(true);
    await okBtn.trigger('click');
    await flushMicro();
    await nextTick();

    expect(sentInfo.subject).toBe('OSS Browser Test');
    expect(sentInfo.to).toBe('a@example.com');
    expect(sentInfo.html).toBe('test');
    const toast = useToastStore();
    expect(toast.items.some((item) => item.type === 'success')).toBe(true);
  });

  it('测试邮件取消路径不发送', async () => {
    vi.useFakeTimers();
    mountAll();
    await nextTick();

    await wrapper.find('[data-testid="settings-smtp-from"]').setValue('a@example.com');

    let sent = 0;
    window.ossBrowser = window.ossBrowser || {};
    window.ossBrowser.mail = {
      send: () => {
        sent += 1;
        return Promise.resolve({ ok: true, data: {} });
      },
    };

    await wrapper.find('[data-testid="settings-smtp-test"]').trigger('click');
    await nextTick();

    const cancelBtn = host.find('[data-testid="dialog-cancel"]');
    expect(cancelBtn.exists()).toBe(true);
    await cancelBtn.trigger('click');
    await flushMicro();

    expect(sent).toBe(0);
  });

  it('from 为空时测试按钮禁用', async () => {
    mountAll();
    await nextTick();
    expect(wrapper.find('[data-testid="settings-smtp-test"]').attributes('disabled')).toBeDefined();
  });
});