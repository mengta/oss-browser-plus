import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import RestoreModal from '@renderer/components/business/modals/RestoreModal.vue';
import BatchRestoreModal from '@renderer/components/business/modals/BatchRestoreModal.vue';
import SetSymlinkModal from '@renderer/components/business/modals/SetSymlinkModal.vue';
import CrcModal from '@renderer/components/business/modals/CrcModal.vue';
import GetAddressModal from '@renderer/components/business/modals/GetAddressModal.vue';
import GrantModal from '@renderer/components/business/modals/GrantModal.vue';
import GrantTokenModal from '@renderer/components/business/modals/GrantTokenModal.vue';
import GrantModalCode from '@renderer/components/business/modals/GrantModalCode.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useToastStore } from '@renderer/stores/toast.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useSettingsStore } from '@renderer/stores/settings.js';
import { userAkStore } from '@renderer/services/user-ak-store.js';

// B3-10：文件操作弹窗第二批（恢复/软链/CRC/地址/授权）契约

vi.mock('@renderer/services/user-ak-store.js', () => ({
  userAkStore: {
    save: vi.fn(() => Promise.resolve()),
    list: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve(null)),
    del: vi.fn(() => Promise.resolve()),
  },
}));

const CURRENT_INFO = { region: 'r', bucket: 'b', key: 'pre/' };
const FILE_ITEM = { name: 'a.txt', path: 'pre/a.txt', isFile: true };

let calls = [];
let fileInfoQueue = [];

function installApis(overrides) {
  const o = overrides || {};
  calls = [];
  fileInfoQueue = [];
  const oss = Object.assign(
    {
      getFileInfo: (auth, region, bucket, key) => {
        calls.push(['getFileInfo', key]);
        const next = fileInfoQueue.length > 0 ? fileInfoQueue.shift() : {};
        return Promise.resolve({ ok: true, data: next });
      },
      restoreFile: (auth, region, bucket, key, days) => {
        calls.push(['restoreFile', region, bucket, key, days]);
        return Promise.resolve({ ok: true, data: {} });
      },
      putObjectSymlinkMeta: (auth, region, bucket, key, target) => {
        calls.push(['putObjectSymlinkMeta', region, bucket, key, target]);
        return Promise.resolve({ ok: true, data: {} });
      },
      signatureUrl2: (auth, region, bucket, key, expires) => {
        calls.push(['signatureUrl2', region, bucket, key, expires]);
        return Promise.resolve({ ok: true, data: 'https://b.oss-cn.aliyuncs.com/pre/a.txt?Signature=x' });
      },
      getOssEndpoint: (auth, region, bucket, eptpl) => {
        calls.push(['getOssEndpoint', region, bucket, eptpl]);
        return Promise.resolve({ ok: true, data: 'https://oss-cn-hangzhou.aliyuncs.com' });
      },
      listAllCustomDomains: () => Promise.resolve({ ok: true, data: [] }),
      listUsableAccelarateDomains: () => Promise.resolve({ ok: true, data: [] }),
    },
    o.oss || {}
  );

  const ram = Object.assign(
    {
      listUsers: () => Promise.resolve({ ok: true, data: [] }),
      listGroups: () => Promise.resolve({ ok: true, data: [] }),
      listRoles: () => Promise.resolve({ ok: true, data: [] }),
      getPolicy: () => Promise.reject(Object.assign(new Error('NoSuchEntity'), { code: 'NoSuchEntity' })),
      createPolicy: (auth, name, policy, desc) => {
        calls.push(['createPolicy', name, policy, desc]);
        return Promise.resolve({ ok: true, data: { Policy: {} } });
      },
      attachPolicyToUser: (auth, name, user) => {
        calls.push(['attachPolicyToUser', name, user]);
        return Promise.resolve({ ok: true, data: {} });
      },
      attachPolicyToGroup: (auth, name, group) => {
        calls.push(['attachPolicyToGroup', name, group]);
        return Promise.resolve({ ok: true, data: {} });
      },
      attachPolicyToRole: (auth, name, role) => {
        calls.push(['attachPolicyToRole', name, role]);
        return Promise.resolve({ ok: true, data: {} });
      },
      createUser: (auth, user) => {
        calls.push(['createUser', user]);
        return Promise.resolve({ ok: true, data: {} });
      },
      createAccessKey: (auth, name) => {
        calls.push(['createAccessKey', name]);
        return Promise.resolve({ ok: true, data: { AccessKey: { AccessKeyId: 'AK-1', AccessKeySecret: 'SK-1' } } });
      },
    },
    o.ram || {}
  );

  const sts = Object.assign(
    {
      assumeRole: (auth, roleArn, policy, seconds) => {
        calls.push(['assumeRole', roleArn, policy, seconds]);
        return Promise.resolve({
          ok: true,
          data: {
            Credentials: {
              AccessKeyId: 'STS-AK',
              AccessKeySecret: 'STS-SK',
              SecurityToken: 'STS-TOKEN',
              Expiration: '2026-11-25T12:00:00.000Z',
            },
          },
        });
      },
    },
    o.sts || {}
  );

  const mail = Object.assign(
    {
      send: (smtp, info) => {
        calls.push(['mail.send', smtp, info]);
        return Promise.resolve({ ok: true, data: true });
      },
    },
    o.mail || {}
  );

  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = oss;
  window.ossBrowser.ram = ram;
  window.ossBrowser.sts = sts;
  window.ossBrowser.mail = mail;
}

function mountWith(component, props, pinia) {
  const active = pinia || getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [active, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('RestoreModal：恢复状态三态与提交', () => {
  it('未恢复：展示天数输入，提交 restoreFile 并关闭', async () => {
    installApis({});
    const wrapper = mountWith(RestoreModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.find('[data-testid="restore-days-row"]').exists()).toBe(true);

    await wrapper.find('[data-testid="restore-days"]').setValue(3);
    await wrapper.find('[data-testid="restore-submit"]').trigger('click');
    await flushPromises();

    expect(calls).toContainEqual(['restoreFile', 'r', 'b', 'pre/a.txt', 3]);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });

  it('恢复中：仅提示，不展示天数输入', async () => {
    installApis({});
    fileInfoQueue.push({ Restore: 'ongoing-request="true"' });
    const wrapper = mountWith(RestoreModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.find('[data-testid="restore-onprogress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="restore-days-row"]').exists()).toBe(false);
  });

  it('已恢复：展示可读截止时间', async () => {
    installApis({});
    fileInfoQueue.push({ Restore: 'ongoing-request="false", expiry-date="2026-12-01T00:00:00.000Z"' });
    const wrapper = mountWith(RestoreModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.find('[data-testid="restore-expiry"]').text()).toContain('2026-12-01');
  });
});

describe('BatchRestoreModal：批量状态与提交', () => {
  const ITEMS = [
    { name: 'a.zip', path: 'pre/a.zip', storageClass: 'Archive', storageStatus: 1 },
    { name: 'b.zip', path: 'pre/b.zip', storageClass: 'Archive', storageStatus: 1 },
  ];

  it('逐项 restoreFile，状态包含恢复中时展示提示', async () => {
    installApis({});
    fileInfoQueue.push({ Restore: 'ongoing-request="true"' }, {});
    const wrapper = mountWith(BatchRestoreModal, { items: ITEMS, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.find('[data-testid="batch-restore-onprogress"]').exists()).toBe(true);

    await wrapper.find('[data-testid="batch-restore-submit"]').trigger('click');
    await flushPromises();
    const restored = calls.filter((c) => c[0] === 'restoreFile');
    expect(restored.length).toBe(2);
    expect(restored[0]).toEqual(['restoreFile', 'r', 'b', 'pre/a.zip', 1]);
  });
});

describe('SetSymlinkModal：校验与设置软链接', () => {
  it('非法目标（含 ..）Toast 且不发请求；合法目标调用 putObjectSymlinkMeta', async () => {
    installApis({});
    const toast = useToastStore();
    const toastSpy = vi.spyOn(toast, 'push');
    const wrapper = mountWith(SetSymlinkModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });

    await wrapper.find('[data-testid="symlink-target"]').setValue('a/../b');
    await wrapper.find('[data-testid="symlink-submit"]').trigger('click');
    await flushPromises();
    expect(calls.some((c) => c[0] === 'putObjectSymlinkMeta')).toBe(false);
    expect(toastSpy).toHaveBeenCalled();

    await wrapper.find('[data-testid="symlink-target"]').setValue('pre/link-a');
    await wrapper.find('[data-testid="symlink-submit"]').trigger('click');
    await flushPromises();
    expect(calls).toContainEqual(['putObjectSymlinkMeta', 'r', 'b', 'pre/link-a', 'pre/a.txt']);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });
});

describe('CrcModal：CRC64 展示与文档链接', () => {
  it('展示 HashCrc64ecma；点击文档链接经 system.openExternal', async () => {
    installApis({});
    fileInfoQueue.push({ HashCrc64ecma: '1234567890123456789' });
    const openSpy = vi.spyOn(window.ossBrowser.system, 'openExternal');
    const wrapper = mountWith(CrcModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.find('[data-testid="crc-value"]').text()).toBe('1234567890123456789');

    await wrapper.find('[data-testid="crc-doc-link"]').trigger('click');
    expect(openSpy.mock.calls[0][0]).toContain('help.aliyun.com');
  });
});

describe('GetAddressModal：签名链接/域名/邮件', () => {
  it('无公共 URL 时进入签名步骤，生成后展示地址', async () => {
    installApis({});
    const wrapper = mountWith(GetAddressModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.find('[data-testid="address-sign"]').exists()).toBe(true);

    await wrapper.find('[data-testid="address-sec"]').setValue(600);
    await wrapper.find('[data-testid="address-generate"]').trigger('click');
    await flushPromises();

    expect(calls).toContainEqual(['signatureUrl2', 'r', 'b', 'pre/a.txt', 600]);
    expect(wrapper.find('[data-testid="address-signed-url"]').element.value).toContain('Signature=x');
  });

  it('自定义域名切换重写 host 并记忆；邮件分享调用 mail.send', async () => {
    installApis({
      oss: {
        listAllCustomDomains: () => Promise.resolve({ ok: true, data: ['cdn.example.com'] }),
      },
    });
    const settings = useSettingsStore();
    settings.mailSmtp = { host: 'h', port: 465, secure: true, user: 'u', pass: 'p', from: 'from@x.com' };
    const wrapper = mountWith(GetAddressModal, { item: FILE_ITEM, currentInfo: CURRENT_INFO });
    await flushPromises();

    await wrapper.find('[data-testid="address-sec"]').setValue(600);
    await wrapper.find('[data-testid="address-generate"]').trigger('click');
    await flushPromises();

    const domainSelect = wrapper.find('[data-testid="address-domain"]');
    expect(domainSelect.exists()).toBe(true);
    await domainSelect.setValue('cdn.example.com');
    await domainSelect.trigger('change');
    await flushPromises();
    expect(wrapper.find('[data-testid="address-signed-url"]').element.value).toBe(
      'https://cdn.example.com/pre/a.txt?Signature=x'
    );
    expect(localStorage.getItem('_lastSelectedDomain')).toBe('cdn.example.com');

    await wrapper.find('[data-testid="address-toggle-send"]').trigger('click');
    await wrapper.find('[data-testid="address-email"]').setValue('to@x.com');
    await wrapper.find('[data-testid="address-send"]').trigger('click');
    await flushPromises();

    const mailCall = calls.find((c) => c[0] === 'mail.send');
    expect(mailCall[2].to).toBe('to@x.com');
    expect(mailCall[2].subject).toContain('[a.txt]');
    expect(mailCall[2].html).toContain('a.txt');
  });
});

describe('GrantModal：简化 Policy 授权', () => {
  it('默认生成只读 policy 与策略名；授权给已有用户（getPolicy 失败→createPolicy→attach）', async () => {
    installApis({
      ram: {
        listUsers: () => Promise.resolve({ ok: true, data: [{ UserName: 'u1' }] }),
      },
    });
    const wrapper = mountWith(GrantModal, { items: [FILE_ITEM], currentInfo: CURRENT_INFO });
    await flushPromises();

    expect(wrapper.find('[data-testid="grant-policy-name"]').element.value).toBe('plc-readOnly-a.txt');
    // 默认策略名含对象扩展名（原版即非合法 policyName），需手动改为合法名后提交
    await wrapper.find('[data-testid="grant-policy-name"]').setValue('plc-readonly-test');
    await wrapper.find('[data-testid="grant-user"]').setValue('u1');
    await wrapper.find('[data-testid="grant-submit"]').trigger('click');
    await flushPromises();

    const create = calls.find((c) => c[0] === 'createPolicy');
    expect(create[1]).toBe('plc-readonly-test');
    expect(create[2]).toContain('oss:Get*');
    expect(calls).toContainEqual(['attachPolicyToUser', 'plc-readonly-test', 'u1']);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });

  it('切换读写权限更新 policy actions 与策略名', async () => {
    installApis({});
    const wrapper = mountWith(GrantModal, { items: [FILE_ITEM], currentInfo: CURRENT_INFO });
    await flushPromises();
    await wrapper.find('[data-testid="grant-priv-readWrite"]').setValue(true);
    await wrapper.find('[data-testid="grant-priv-readWrite"]').trigger('change');
    await flushPromises();
    expect(wrapper.find('[data-testid="grant-policy-name"]').element.value).toBe('plc-readWrite-a.txt');

    await wrapper.find('[data-testid="grant-toggle-policy"]').trigger('click');
    const policyText = wrapper.find('[data-testid="grant-policy"]').element.value;
    expect(policyText).toContain('oss:Put*');
    expect(policyText).toContain('oss:AbortMultipartUpload');
  });

  it('新建子用户：createUser → createAccessKey → 本地保存 → 授权 → 邮件/授权码', async () => {
    installApis({});
    const pinia = getActivePinia();
    const settings = useSettingsStore(pinia);
    settings.mailSmtp = { host: 'h', port: 465, secure: true, user: 'u', pass: 'p', from: 'from@x.com' };
    userAkStore.save.mockClear();
    const wrapper = mountWith(GrantModal, { items: [FILE_ITEM], currentInfo: CURRENT_INFO }, pinia);
    await flushPromises();

    const createdName = wrapper.find('[data-testid="grant-new-name"]').element.value;
    expect(createdName.indexOf('usr-')).toBe(0);
    await wrapper.find('[data-testid="grant-policy-name"]').setValue('plc-readonly-new');
    await wrapper.find('[data-testid="grant-new-email"]').setValue('to@x.com');
    await wrapper.find('[data-testid="grant-submit"]').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(calls.some((c) => c[0] === 'createUser')).toBe(true);
    expect(calls).toContainEqual(['createAccessKey', createdName]);
    expect(userAkStore.save).toHaveBeenCalledWith({
      AccessKeyId: 'AK-1',
      AccessKeySecret: 'SK-1',
      UserName: createdName,
    });
    expect(calls.some((c) => c[0] === 'attachPolicyToUser')).toBe(true);
    expect(calls.some((c) => c[0] === 'mail.send')).toBe(true);
    const ui = useUiStore(pinia);
    expect(ui.isOpen('grant-code')).toBe(true);
  });
});

describe('GrantTokenModal：生成授权码', () => {
  it('角色加载 + assumeRole 参数 + base64 授权码内容', async () => {
    installApis({
      ram: {
        listRoles: () =>
          Promise.resolve({
            ok: true,
            data: [{ RoleName: 'role1', Arn: 'acs:ram::123:role/role1' }],
          }),
      },
    });
    const wrapper = mountWith(GrantTokenModal, {
      item: { name: 'dir', path: 'pre/dir/', isFolder: true },
      currentInfo: CURRENT_INFO,
    });
    await flushPromises();

    await wrapper.find('[data-testid="grant-token-role"]').setValue('acs:ram::123:role/role1');
    await wrapper.find('[data-testid="grant-token-submit"]').trigger('click');
    await flushPromises();
    await flushPromises();

    const call = calls.find((c) => c[0] === 'assumeRole');
    expect(call[1]).toBe('acs:ram::123:role/role1');
    expect(call[2]).toContain('oss:Get*');
    expect(call[3]).toBe(3600);

    const token = wrapper.find('[data-testid="grant-token-value"]').element.value;
    expect(token.length).toBeGreaterThan(10);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    expect(decoded.id).toBe('STS-AK');
    expect(decoded.stoken).toBe('STS-TOKEN');
    expect(decoded.osspath).toBe('oss://b/pre/dir/');
    expect(decoded.privilege).toBe('readOnly');
  });
});

describe('GrantModalCode：授权码展示与复制', () => {
  it('从邮件 HTML 提取 code 内容并复制', async () => {
    installApis({});
    const toast = useToastStore();
    const copySpy = vi.spyOn(toast, 'copy').mockResolvedValue({ ok: true });
    const pushSpy = vi.spyOn(toast, 'push');
    const wrapper = mountWith(GrantModalCode, {
      info: { html: 'token:<br/><code style="x">eyJpZCI6MX0=</code><br/>end' },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="grant-code-content"]').text()).toBe('eyJpZCI6MX0=');

    await wrapper.find('[data-testid="grant-code-copy"]').trigger('click');
    await flushPromises();
    expect(copySpy).toHaveBeenCalledWith({ message: 'eyJpZCI6MX0=' });
    expect(pushSpy).toHaveBeenCalled();
  });
});