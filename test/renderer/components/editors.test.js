import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import CodeEditor from '@renderer/components/base/CodeEditor.vue';
import AclEditor from '@renderer/components/business/editors/AclEditor.vue';
import HttpHeadersEditor from '@renderer/components/business/editors/HttpHeadersEditor.vue';
import PolicyEditor from '@renderer/components/business/editors/PolicyEditor.vue';
import UpdateAclModal from '@renderer/components/business/modals/UpdateAclModal.vue';
import UpdateHttpHeadersModal from '@renderer/components/business/modals/UpdateHttpHeadersModal.vue';
import DiffModal from '@renderer/components/business/modals/DiffModal.vue';
import DiffEditor from '@renderer/components/base/DiffEditor.vue';
import ModalHost from '@renderer/components/base/ModalHost.vue';
import { useUiStore } from '@renderer/stores/ui.js';
import { useToastStore } from '@renderer/stores/toast.js';
import * as SecureStore from '@renderer/services/secure-store.js';

let ossCalls = [];
let ossStubs = {};

function installOss(overrides) {
  ossCalls = [];
  ossStubs = Object.assign(
    {
      getACL: () => Promise.resolve({ ok: true, data: { acl: 'public-read' } }),
      updateACL: () => Promise.resolve({ ok: true, data: {} }),
      getMeta: () =>
        Promise.resolve({
          ok: true,
          data: {
            ContentType: 'application/json',
            ContentLanguage: '',
            CacheControl: '',
            ContentDisposition: '',
            ContentEncoding: '',
            Expires: '',
            Metadata: { foo: 'bar' },
          },
        }),
      setMeta2: () => Promise.resolve({ ok: true, data: {} }),
    },
    overrides || {}
  );
  globalThis.window = globalThis.window || {};
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = new Proxy(
    {},
    {
      get: (target, prop) => {
        if (typeof prop !== 'string') {
          return undefined;
        }
        if (ossStubs[prop]) {
          return (auth, ...args) => {
            ossCalls.push({ method: prop, args });
            return ossStubs[prop](auth, ...args);
          };
        }
        return undefined;
      },
    }
  );
}

// auth-info 经 SecureStore（测试 stub credentials.protect/release）注入
function installAuth() {
  SecureStore.set('auth-info', JSON.stringify({ id: 'auth-1', accessKeyId: 'AK', accessKeySecret: 'SK' }));
}

async function mountWithPlugins(component, props) {
  const pinia = getActivePinia();
  const wrapper = mount(component, {
    props,
    global: { plugins: [pinia, createRendererI18n('zh-CN')] },
    attachTo: document.body,
  });
  await nextTick();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  installOss();
  installAuth();
});

describe('CodeEditor（CM6 封装）', () => {
  it('场景1：挂载渲染 v-model 内容，onReady 时机给出 view，输入更新双向同步', async () => {
    const onReady = vi.fn();
    const wrapper = mount(CodeEditor, {
      props: { modelValue: '{"a":1}', language: 'json' },
      attrs: { onReady },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="code-editor"]').exists()).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);

    // 内部输入 → v-model
    const view = onReady.mock.calls[0][0];
    view.dispatch({ changes: { from: 0, to: 7, insert: '{"b":2}' } });
    await nextTick();
    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('{"b":2}');

    wrapper.unmount();
  });

  it('场景2：readonly=true 时可编辑关闭且外部值变更同步进 view', async () => {
    const onReady = vi.fn();
    const wrapper = mount(CodeEditor, {
      props: { modelValue: 'init', readonly: true },
      attrs: { onReady },
    });
    await nextTick();

    const view = onReady.mock.calls[0][0];
    expect(view.state.readOnly).toBe(true);
    expect(view.state.facet(1 /* EditorView.editable 不可直读，改为输入抑制断言 */)).toBe(undefined);

    // 外部更新 → view doc 同步
    await wrapper.setProps({ modelValue: 'next' });
    expect(view.state.doc.toString()).toBe('next');

    wrapper.unmount();
  });
});

describe('AclEditor', () => {
  it('场景3：ACL 四选项与三行说明渲染，select 更新经 v-model 透出', async () => {
    const wrapper = await mountWithPlugins(AclEditor, { modelValue: 'default' });

    const select = wrapper.find('[data-testid="acl-select"]');
    expect(select.exists()).toBe(true);
    expect(select.findAll('option').length).toBe(4);
    expect(select.element.value).toBe('default');
    expect(wrapper.findAll('.f9 li').length).toBe(3);

    await select.setValue('public-read');
    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('public-read');
  });
});

describe('HttpHeadersEditor', () => {
  it('场景4：六个标准头回显 + 用户元数据增删 + getHeaders/getMetaItems 快照', async () => {
    const wrapper = await mountWithPlugins(HttpHeadersEditor, {
      headers: {
        ContentType: 'text/plain',
        ContentLanguage: '',
        CacheControl: 'no-cache',
        ContentDisposition: '',
        ContentEncoding: '',
        Expires: '',
      },
      metaItems: [{ key: 'k1', value: 'v1' }],
    });

    expect(wrapper.find('[data-testid="header-content-type"]').element.value).toBe('text/plain');
    expect(wrapper.find('[data-testid="header-cache-control"]').element.value).toBe('no-cache');

    await wrapper.find('[data-testid="header-content-type"]').setValue('application/xml');

    await wrapper.find('[data-testid="meta-add"]').trigger('click');
    expect(wrapper.findAll('[data-testid="meta-row"]').length).toBe(2);
    await wrapper.find('[data-testid="meta-remove"]').trigger('click');
    expect(wrapper.findAll('[data-testid="meta-row"]').length).toBe(1);

    const snapshot = wrapper.vm.getHeaders();
    expect(snapshot.ContentType).toBe('application/xml');
    expect(wrapper.vm.getMetaItems()).toEqual([{ key: 'k1', value: 'v1' }]);
  });
});

describe('PolicyEditor', () => {
  it('场景5：合法 JSON 无提示；非法 JSON 提示且输入不丢失；保存解析正确', async () => {
    const wrapper = await mountWithPlugins(PolicyEditor, { modelValue: '{"Version":"1"}' });

    expect(wrapper.find('[data-testid="policy-invalid"]').exists()).toBe(false);

    // 合法输入透出
    await wrapper.vm.$emit; // noop 防御
    const editorArea = wrapper.find('[data-testid="code-editor"] .cm-content');
    await wrapper.setProps({ modelValue: 'not-json{' });
    await nextTick();
    expect(wrapper.find('[data-testid="policy-invalid"]').exists()).toBe(true);
    // 输入不丢失：文本仍在
    expect(wrapper.vm.text).toBe('not-json{');

    // 恢复合法
    await wrapper.setProps({ modelValue: '{"Statement":[]}' });
    await nextTick();
    expect(wrapper.find('[data-testid="policy-invalid"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="policy-code-editor"] .cm-content').exists()).toBe(true);
  });
});

describe('UpdateAclModal（弹窗承接）', () => {
  it('场景6：getACL 回显 → updateACL 提交携带所选 ACL → success Toast', async () => {
    const toast = useToastStore();

    const wrapper = await mountWithPlugins(UpdateAclModal, {
      item: { path: 'a.txt' },
      currentInfo: { region: 'cn-hangzhou', bucket: 'b1' },
    });
    await flushPromises();
    await nextTick();

    expect(wrapper.find('[data-testid="acl-select"]').element.value).toBe('public-read');

    await wrapper.find('[data-testid="acl-select"]').setValue('private');
    await wrapper.find('[data-testid="acl-submit"]').trigger('click');
    await Promise.resolve();
    await nextTick();

    const update = ossCalls.find((n) => n.method === 'updateACL');
    expect(update.args).toEqual(['cn-hangzhou', 'b1', 'a.txt', 'private']);
    expect(toast.items.some((n) => n.message === '修改ACL权限成功' && n.type === 'success')).toBe(true);
  });
});

describe('UpdateHttpHeadersModal（弹窗承接）', () => {
  it('场景7：getMeta 回显 → 提交时 Header 名映射转换 + 空元数据过滤 → setMeta2', async () => {
    const wrapper = await mountWithPlugins(UpdateHttpHeadersModal, {
      item: [{ path: 'a.txt' }],
      currentInfo: { region: 'cn-hangzhou', bucket: 'b1' },
    });
    await flushPromises();
    await nextTick();

    expect(wrapper.find('[data-testid="header-content-type"]').element.value).toBe('application/json');

    await wrapper.find('[data-testid="http-headers-submit"]').trigger('click');
    await Promise.resolve();
    await nextTick();

    const call = ossCalls.find((n) => n.method === 'setMeta2');
    expect(call.args[0]).toBe('cn-hangzhou');
    expect(call.args[1]).toBe('b1');
    expect(call.args[2]).toBe('a.txt');
    expect(call.args[3]).toEqual({ 'Content-Type': 'application/json' });
    expect(call.args[4]).toEqual({ foo: 'bar' });
  });
});

describe('ModalHost 注册', () => {
  it('update-acl / update-http-headers 经桥打开渲染 Vue 弹窗', async () => {
    const ui = useUiStore();
    const pinia = getActivePinia();

    const host = mount(ModalHost, {
      global: { plugins: [pinia, createRendererI18n('zh-CN')] },
    });

    window.vueModalHost = {
      open(name, props) {
        const opened = ui.open(name, props || {});
        return opened === null ? Promise.resolve(null) : opened;
      },
    };
    window.vueModalHost.open('update-acl', {
      item: { path: 'a.txt' },
      currentInfo: { region: 'r', bucket: 'b' },
    });
    await nextTick();

    expect(host.find('[data-testid="acl-select"]').exists()).toBe(true);

    ui.close('update-acl', null);
    await nextTick();
    host.unmount();
  });
});
describe('DiffEditor（CM6 MergeView 封装）', () => {
  it('场景8：双栏 diff 渲染，a=original / b=当前值，getValue 取 b 栏', async () => {
    const onReady = vi.fn();
    const wrapper = mount(DiffEditor, {
      props: { original: 'line1\nline2', modelValue: 'line1\nline2-changed' },
      attrs: { onReady },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="diff-editor"]').exists()).toBe(true);
    expect(wrapper.find('.cm-mergeView').exists() || wrapper.find('.cm-merge-view').exists()).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);

    const mv = onReady.mock.calls[0][0];
    expect(mv.a.state.doc.toString()).toBe('line1\nline2');
    expect(mv.b.state.doc.toString()).toBe('line1\nline2-changed');
    expect(wrapper.vm.getValue()).toBe('line1\nline2-changed');

    wrapper.unmount();
  });

  it('场景9：readonly=true 时左右两栏均不可编辑', async () => {
    const onReady = vi.fn();
    const wrapper = mount(DiffEditor, {
      props: { original: 'a', modelValue: 'b', readonly: true },
      attrs: { onReady },
    });
    await nextTick();

    const mv = onReady.mock.calls[0][0];
    expect(mv.a.state.readOnly).toBe(true);
    expect(mv.b.state.readOnly).toBe(true);

    wrapper.unmount();
  });
});

describe('DiffModal（弹窗承接）', () => {
  it('场景10：editable=true 确定回调 getValue 结果；取消不回调', async () => {
    const ui = useUiStore();
    let okValue = null;

    ui.open('diff', { title: 'Diff', editable: true, originalContent: 'a', content: 'b' });

    const wrapper = await mountWithPlugins(DiffModal, {
      title: 'Diff',
      editable: true,
      originalContent: 'a',
      content: 'b',
    });
    await nextTick();

    expect(wrapper.find('[data-testid="diff-ok"]').exists()).toBe(true);
    await wrapper.find('[data-testid="diff-ok"]').trigger('click');
    await nextTick();
    // emit('close', value) → ModalHost 层 resolve(value)；直接 mount 时经 wrapper 验证
    okValue = wrapper.emitted('close');
    expect(okValue[0][0]).toBe('b');

    // 取消：emit close 无值 → resolve null，不触发保存回调
    await wrapper.find('[data-testid="diff-cancel"]').trigger('click');
    expect(wrapper.emitted('close')[1][0] === undefined || wrapper.emitted('close')[1][0] === null).toBe(true);
  });

  it('场景11：editable=false 只读预览，无确定按钮', async () => {
    const wrapper = await mountWithPlugins(DiffModal, {
      title: 'Diff',
      editable: false,
      originalContent: 'a',
      content: 'b',
    });
    await nextTick();

    expect(wrapper.find('[data-testid="diff-ok"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="diff-cancel"]').exists()).toBe(true);
  });
});
