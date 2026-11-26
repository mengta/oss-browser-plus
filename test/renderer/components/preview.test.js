import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import RestoreChecker from '@renderer/components/business/preview/RestoreChecker.vue';
import PreviewBar from '@renderer/components/business/preview/PreviewBar.vue';
import PictureModal from '@renderer/components/business/preview/PictureModal.vue';
import MediaModal from '@renderer/components/business/preview/MediaModal.vue';
import DocModal from '@renderer/components/business/preview/DocModal.vue';
import OthersModal from '@renderer/components/business/preview/OthersModal.vue';
import CodeModal from '@renderer/components/business/preview/CodeModal.vue';
import FlvPlayer from '@renderer/components/base/FlvPlayer.vue';
import FilesPage from '@renderer/pages/FilesPage.vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';

// B3-11：四类预览基座（RestoreChecker / PreviewBar）契约

const BUCKET_INFO = { region: 'r', bucket: 'b', key: 'pre/' };
const OBJECT_INFO = { name: 'a.png', path: 'pre/a.png', size: 1024, storageClass: 'Standard' };

let calls = [];
let fileInfoQueue = [];

function installOss(overrides) {
  calls = [];
  fileInfoQueue = [];
  const oss = Object.assign(
    {
      getFileInfo: (auth, region, bucket, key) => {
        calls.push(['getFileInfo', key]);
        const next = fileInfoQueue.length > 0 ? fileInfoQueue.shift() : {};
        return Promise.resolve({ ok: true, data: next });
      },
      signatureUrl2: (auth, region, bucket, key, expires, xprocess) => {
        calls.push(['signatureUrl2', key, expires, xprocess]);
        return Promise.resolve({ ok: true, data: 'https://b.oss-cn.aliyuncs.com/' + key + '?sig=1' });
      },
      getImageBase64Url: (auth, region, bucket, key) => {
        calls.push(['getImageBase64Url', key]);
        return Promise.resolve({ ok: true, data: { ContentType: 'image/png', Body: new Uint8Array([1, 2, 3]) } });
      },
      getContent: (auth, region, bucket, key) => {
        calls.push(['getContent', key]);
        return Promise.resolve({ ok: true, data: 'line-1\nline-2' });
      },
      saveContent: (auth, region, bucket, key, content, isCodeSave) => {
        calls.push(['saveContent', region, bucket, key, content, isCodeSave]);
        return Promise.resolve({ ok: true, data: true });
      },
      listAllBuckets: () => Promise.resolve({ ok: true, data: [] }),
      listFiles: () => Promise.resolve({ ok: true, data: { data: [], marker: null } }),
    },
    overrides || {}
  );
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = oss;
}

function mountWith(component, props, options) {
  const pinia = (options && options.pinia) || getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    slots: (options && options.slots) || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('RestoreChecker：恢复状态判定', () => {
  it('普通对象：直接展示内容（ready 事件）', async () => {
    installOss({});
    const wrapper = mountWith(
      RestoreChecker,
      { bucketInfo: BUCKET_INFO, objectInfo: OBJECT_INFO, fileType: { type: 'picture' } },
      { slots: { default: '<div data-testid="slot-content">content</div>' } }
    );
    await flushPromises();

    expect(wrapper.find('[data-testid="restore-check-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slot-content"]').exists()).toBe(true);
    expect(wrapper.emitted('ready')).toBeTruthy();
  });

  it('Archive 未恢复：提示并可从弹窗发起恢复', async () => {
    installOss({});
    const ui = useUiStore();
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(true);
    const wrapper = mountWith(RestoreChecker, {
      bucketInfo: BUCKET_INFO,
      objectInfo: Object.assign({}, OBJECT_INFO, { storageClass: 'Archive', storageStatus: 1 }),
      fileType: { type: 'picture' },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="restore-check-need"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="restore-check-content"]').exists()).toBe(false);

    await wrapper.find('[data-testid="restore-check-now"]').trigger('click');
    await flushPromises();
    expect(openSpy.mock.calls[0][0]).toBe('restore');
    expect(wrapper.emitted('restore-submit')).toBeTruthy();
  });

  it('恢复中：仅提示，不展示内容', async () => {
    installOss({});
    fileInfoQueue.push({ Restore: 'ongoing-request="true"' });
    const wrapper = mountWith(RestoreChecker, {
      bucketInfo: BUCKET_INFO,
      objectInfo: OBJECT_INFO,
      fileType: { type: 'picture' },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="restore-check-progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="restore-check-content"]').exists()).toBe(false);
    expect(wrapper.emitted('ready')).toBeFalsy();
  });

  it('已恢复：显示截止时间并展示内容', async () => {
    installOss({});
    fileInfoQueue.push({ Restore: 'ongoing-request="false", expiry-date="2026-12-01T00:00:00.000Z"' });
    const wrapper = mountWith(RestoreChecker, {
      bucketInfo: BUCKET_INFO,
      objectInfo: OBJECT_INFO,
      fileType: { type: 'picture' },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="restore-check-ready"]').text()).toContain('2026-12-01');
    expect(wrapper.find('[data-testid="restore-check-content"]').exists()).toBe(true);
    expect(wrapper.emitted('ready')).toBeTruthy();
  });
});

describe('PreviewBar：预览操作入口', () => {
  it('下载：选择目录取消时不创建任务；地址/HTTP头/ACL 打开对应弹窗', async () => {
    installOss({});
    const ui = useUiStore();
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);
    const wrapper = mountWith(PreviewBar, { objectInfo: OBJECT_INFO, bucketInfo: BUCKET_INFO });
    await flushPromises();

    await wrapper.find('[data-testid="preview-download"]').trigger('click');
    await flushPromises();

    await wrapper.find('[data-testid="preview-address"]').trigger('click');
    expect(openSpy.mock.calls[0][0]).toBe('get-address');

    await wrapper.find('[data-testid="preview-http-headers"]').trigger('click');
    expect(openSpy.mock.calls[1][0]).toBe('update-http-headers');

    await wrapper.find('[data-testid="preview-acl"]').trigger('click');
    expect(openSpy.mock.calls[2][0]).toBe('update-acl');
  });

  it('STS 账号隐藏获取地址入口', async () => {
    installOss({});
    const wrapper = mountWith(PreviewBar, { objectInfo: OBJECT_INFO, bucketInfo: BUCKET_INFO });
    await flushPromises();

    const auth = (await import('@renderer/stores/auth.js')).useAuthStore();
    auth.info = { id: 'STS.abc', secret: 'sk' };
    await flushPromises();
    expect(wrapper.find('[data-testid="preview-address"]').exists()).toBe(false);
  });
});
describe('PictureModal：图片预览加载', () => {
  it('普通对象走 signatureUrl2 原图；≥5MB 走压缩 process', async () => {
    installOss({});
    const small = mountWith(PictureModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { size: 1024 }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'picture', ext: ['png'] },
    });
    await flushPromises();
    expect(wrapperCall('signatureUrl2', 'pre/a.png')).toBeTruthy();
    expect(small.find('[data-testid="picture-image"]').attributes('src')).toContain('sig=1');

    calls = [];
    const big = mountWith(PictureModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { size: 6 * 1024 * 1024 }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'picture', ext: ['png'] },
    });
    await flushPromises();
    const bigCall = calls.find((c) => c[0] === 'signatureUrl2');
    expect(bigCall[3]).toBe('image/quality,q_10');
    expect(big.find('[data-testid="picture-image"]').exists()).toBe(true);
  });

  it('STS 账号走 getImageBase64Url 生成 data URL', async () => {
    installOss({});
    const pinia = getActivePinia();
    useAuthStore(pinia).info = { id: 'STS.abc', secret: 'sk' };
    const wrapper = mountWith(
      PictureModal,
      {
        objectInfo: OBJECT_INFO,
        bucketInfo: BUCKET_INFO,
        fileType: { type: 'picture', ext: ['png'] },
      },
      { pinia }
    );
    await flushPromises();
    expect(calls.some((c) => c[0] === 'getImageBase64Url')).toBe(true);
    expect(wrapper.find('[data-testid="picture-image"]').attributes('src')).toContain('data:image/png;base64,');
  });

  function wrapperCall(type, key) {
    return calls.some((c) => c[0] === type && c[1] === key);
  }
});

describe('MediaModal：音视频/FLV 呈现', () => {
  it('audio 渲染 audio；video 渲染 video；flv 给出暂不可预览提示', async () => {
    installOss({});
    const audio = mountWith(MediaModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.mp3', path: 'pre/a.mp3' }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'audio', ext: ['mp3'] },
    });
    await flushPromises();
    expect(audio.find('[data-testid="media-audio"]').exists()).toBe(true);

    const video = mountWith(MediaModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.mp4', path: 'pre/a.mp4' }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'video', ext: ['mp4'] },
    });
    await flushPromises();
    expect(video.find('[data-testid="media-video"]').exists()).toBe(true);

    const flv = mountWith(MediaModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.flv', path: 'pre/a.flv' }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'video', ext: ['flv'] },
    });
    await flushPromises();
    await flushPromises();
    expect(flv.find('[data-testid="flv-player"]').exists()).toBe(true);
    expect(flv.find('[data-testid="flv-iframe"]').attributes('src')).toContain('flv-player.html');
    expect(flv.find('[data-testid="media-video"]').exists()).toBe(false);
  });
});

describe('DocModal / OthersModal：不支持类型提示与文本打开', () => {
  it('DocModal 显示不可预览提示并带预览操作栏', async () => {
    installOss({});
    const wrapper = mountWith(DocModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.pdf', path: 'pre/a.pdf' }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'doc', ext: ['pdf'] },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="doc-unsupported"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="preview-bar"]').exists()).toBe(true);
  });

  it('OthersModal：文本可试打开（打开 preview-code 并关闭）；压缩包不显示按钮', async () => {
    installOss({});
    const pinia = getActivePinia();
    const ui = useUiStore(pinia);
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);
    const txt = mountWith(
      OthersModal,
      {
        objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.txt', path: 'pre/a.txt' }),
        bucketInfo: BUCKET_INFO,
        fileType: { type: 'others', ext: ['txt'] },
      },
      { pinia }
    );
    await flushPromises();
    await txt.find('[data-testid="others-as-code"]').trigger('click');
    expect(openSpy.mock.calls[0][0]).toBe('preview-code');
    expect(txt.emitted('close')).toBeTruthy();

    const zip = mountWith(
      OthersModal,
      {
        objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.zip', path: 'pre/a.zip' }),
        bucketInfo: BUCKET_INFO,
        fileType: { type: 'others', ext: ['zip'] },
      },
      { pinia }
    );
    await flushPromises();
    expect(zip.find('[data-testid="others-as-code"]').exists()).toBe(false);
  });
});

describe('CodeModal：文本内容加载', () => {
  it('getContent 内容渲染到只读区域', async () => {
    installOss({});
    const wrapper = mountWith(CodeModal, {
      objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.js', path: 'pre/a.js' }),
      bucketInfo: BUCKET_INFO,
      fileType: { type: 'code', ext: ['js'] },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="code-editor"]').exists()).toBe(true);
    expect(calls.some((c) => c[0] === 'getContent')).toBe(true);
  });
});

describe('FilesPage：按文件类型分发预览弹窗', () => {
  function mountPage() {
    installOss({});
    const pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore(pinia).info = { id: 'LTAI', secret: 'sk' };
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'files', component: FilesPage },
      ],
    });
    const wrapper = mount(FilesPage, {
      global: { plugins: [pinia, router, createRendererI18n()] },
    });
    const files = useFilesStore(pinia);
    files.bucket = 'b';
    files.prefix = 'pre/';
    files.region = 'r';
    return { wrapper, files, pinia };
  }

  it('picture/video/doc/others/code 分别打开对应弹窗', async () => {
    const { wrapper, files, pinia } = mountPage();
    await flushPromises();
    const ui = useUiStore(pinia);
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);

    const cases = [
      [{ name: 'a.png', path: 'pre/a.png', isFile: true }, 'preview-picture'],
      [{ name: 'a.mp4', path: 'pre/a.mp4', isFile: true }, 'preview-media'],
      [{ name: 'a.pdf', path: 'pre/a.pdf', isFile: true }, 'preview-doc'],
      [{ name: 'a.zip', path: 'pre/a.zip', isFile: true }, 'preview-others'],
      [{ name: 'a.js', path: 'pre/a.js', isFile: true }, 'preview-code'],
    ];

    for (const [item, expected] of cases) {
      files.items = [item];
      await flushPromises();
      await wrapper.find('[data-testid="file-open-link"]').trigger('click');
      expect(openSpy.mock.calls[openSpy.mock.calls.length - 1][0]).toBe(expected);
    }
  });
});

describe('CodeModal：完整代码预览语义（B3-12）', () => {
  function mountCode(overrides, options) {
    return mountWith(
      CodeModal,
      Object.assign(
        {
          objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.js', path: 'pre/a.js', size: 1024 }),
          bucketInfo: BUCKET_INFO,
          fileType: { type: 'code', ext: ['js'] },
        },
        overrides || {}
      ),
      options
    );
  }

  it('超过 5MB：提示下载且不读取内容', async () => {
    installOss({});
    const wrapper = mountCode({ objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.js', path: 'pre/a.js', size: 6 * 1024 * 1024 }) });
    await flushPromises();
    expect(wrapper.find('[data-testid="code-too-large"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="code-download"]').exists()).toBe(true);
    expect(calls.some((c) => c[0] === 'getContent')).toBe(false);
  });

  it('Symlink 只读：CodeEditor readonly 且无保存按钮', async () => {
    installOss({});
    const wrapper = mountCode({
      objectInfo: Object.assign({}, OBJECT_INFO, { name: 'a.js', path: 'pre/a.js', type: 'Symlink' }),
      fileType: { type: 'code', ext: ['js'] },
    });
    await flushPromises();
    const editor = wrapper.findComponent({ name: 'CodeEditor' });
    expect(editor.props('readonly')).toBe(true);
    expect(wrapper.find('[data-testid="code-save"]').exists()).toBe(false);
  });

  it('内容未修改：保存提示 content.isnot.modified，不打开 Diff', async () => {
    installOss({});
    const pinia = getActivePinia();
    const ui = useUiStore(pinia);
    const openSpy = vi.spyOn(ui, 'open');
    const toast = (await import('@renderer/stores/toast.js')).useToastStore(pinia);
    const pushSpy = vi.spyOn(toast, 'push');
    const wrapper = mountCode({}, { pinia });
    await flushPromises();
    await wrapper.find('[data-testid="code-save"]').trigger('click');
    await flushPromises();
    expect(openSpy).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledWith('content.isnot.modified', 'info', 2000);
  });

  it('修改后保存：Diff 确认 → saveContent → 关闭', async () => {
    installOss({});
    const pinia = getActivePinia();
    const ui = useUiStore(pinia);
    vi.spyOn(ui, 'open').mockResolvedValue('new-content');
    const wrapper = mountCode({}, { pinia });
    await flushPromises();
    wrapper.findComponent({ name: 'CodeEditor' }).vm.$emit('update:modelValue', 'changed');
    await flushPromises();
    await wrapper.find('[data-testid="code-save"]').trigger('click');
    await flushPromises();
    const saveCall = calls.find((c) => c[0] === 'saveContent');
    expect(saveCall[1]).toBe('r');
    expect(saveCall[2]).toBe('b');
    expect(saveCall[3]).toBe('pre/a.js');
    expect(saveCall[4]).toBe('new-content');
    expect(saveCall[5]).toBe(true);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });
});

describe('FlvPlayer：静态服务装配（B3-12）', () => {
  beforeEach(() => {
    installOss({});
  });

  it('端口就绪：iframe 指向 flv-player.html?src=<encoded>', async () => {
    const wrapper = mountWith(FlvPlayer, { src: 'https://b.oss-cn.aliyuncs.com/a b.flv', autoplay: true });
    await flushPromises();
    const iframe = wrapper.find('[data-testid="flv-iframe"]');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toContain('/flv-player.html?src=');
    expect(iframe.attributes('src')).toContain('a%20b.flv');
    expect(iframe.attributes('src')).toContain('autoplay=autoplay');
  });

  it('端口未就绪：展示等价不可预览提示', async () => {
    window.ossBrowser.system = Object.assign({}, window.ossBrowser.system, {
      getStaticServerPort: () => Promise.resolve({ ok: false, code: 'UNAVAILABLE', message: 'not ready' }),
    });
    const wrapper = mountWith(FlvPlayer, { src: 'https://x/a.flv' });
    await flushPromises();
    expect(wrapper.find('[data-testid="flv-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="flv-iframe"]').exists()).toBe(false);
  });
});
