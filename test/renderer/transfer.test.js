import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { useTransferStore } from '@renderer/stores/transfer.js';
import { useSettingsStore } from '@renderer/stores/settings.js';
import { useUiStore } from '@renderer/stores/ui.js';
import UploadsPanel from '@renderer/components/business/transfer/UploadsPanel.vue';
import DropZone from '@renderer/components/base/DropZone.vue';
import FileDialogButton from '@renderer/components/base/FileDialogButton.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';

// B3-06：上传链路契约（store 调度/持久化、面板、拖拽、文件选择）

const AUTH = { id: 'LTAI5tTest', secret: 'sk', eptpl: 'https://{region}.aliyuncs.com' };

let transferCalls = [];
let progressCb = null;

function installTransfer(overrides) {
  transferCalls = [];
  progressCb = null;
  const base = {
    subscribe(cb) {
      progressCb = cb;
      return 'sub-1';
    },
    unsubscribe() {},
    scanFolder(localPath) {
      transferCalls.push(['scanFolder', localPath]);
      return Promise.resolve({
        ok: true,
        data: [
          { path: localPath + '/dir', name: 'dir', size: 0, relative: 'dir/', isDir: true },
          { path: localPath + '/dir/a.txt', name: 'a.txt', size: 10, relative: 'dir/a.txt', isDir: false },
          { path: localPath + '/b.txt', name: 'b.txt', size: 20, relative: 'b.txt', isDir: false },
        ],
      });
    },
    createUpload(auth, options) {
      transferCalls.push(['createUpload', auth, options]);
      return Promise.resolve({ ok: true, data: { taskId: 'up-' + transferCalls.length } });
    },
    pause(id) {
      transferCalls.push(['pause', id]);
      if (progressCb) progressCb({ taskId: id, status: 'stopped', prog: { loaded: 0, total: 0 } });
      return Promise.resolve({ ok: true, data: true });
    },
    resume(id) {
      transferCalls.push(['resume', id]);
      // 模拟主进程 job.start → statuschange 广播（避免 store 重复 resume 同一任务）
      if (progressCb) progressCb({ taskId: id, status: 'running', prog: { loaded: 0, total: 0 } });
      return Promise.resolve({ ok: true, data: true });
    },
    clear(id) {
      transferCalls.push(['clear', id]);
      return Promise.resolve({ ok: true, data: true });
    },
    retry(id) {
      transferCalls.push(['retry', id]);
      return Promise.resolve({ ok: true, data: { taskId: 'up-retry' } });
    },
    errorDetail(id) {
      return Promise.resolve({ ok: true, data: { ecCode: 'E1', requestId: 'R1', message: 'boom' } });
    },
  };
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.transfer = Object.assign(base, overrides || {});
  window.ossBrowser.storage = window.ossBrowser.storage || {
    readProgress: () => Promise.resolve({ ok: true, data: { exists: false, content: '' } }),
    writeProgress: () => Promise.resolve({ ok: true, data: true }),
  };
}

function installOssCreateFolder() {
  window.ossBrowser.oss = {
    createFolder: (auth, region, bucket, key) => {
      transferCalls.push(['createFolder', region, bucket, key]);
      return Promise.resolve({ ok: true, data: {} });
    },
  };
}

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.transfer;
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

async function seedStore() {
  installTransfer({});
  installOssCreateFolder();
  const { useAuthStore } = await import('@renderer/stores/auth.js');
  const auth = useAuthStore();
  auth.info = AUTH;
  const store = useTransferStore();
  store.subscribe();
  return store;
}

describe('transfer store：目录递归入队', () => {
  it('scanFolder 展开目录+文件：目录 createFolder（relative 结尾 /），文件 createUpload（prefix 拼接）', async () => {
    const store = await seedStore();
    useSettingsStore().maxUploadJobCount = 3;
    await store.createUploadJobs(['C:/local/dir'], { region: 'oss-cn-hangzhou', bucket: 'demo-b', key: 'root/' });

    const createFolder = transferCalls.find((c) => c[0] === 'createFolder');
    expect(createFolder).toEqual(['createFolder', 'oss-cn-hangzhou', 'demo-b', 'root/dir/']);

    const uploads = transferCalls.filter((c) => c[0] === 'createUpload');
    expect(uploads.length).toBe(2);
    expect(uploads[0][2].to.key).toBe('root/dir/a.txt');
    expect(uploads[1][2].to.key).toBe('root/b.txt');
    expect(uploads[0][2].from.name).toBe('a.txt');
    expect(uploads[0][1].accessKeyId).toBe(AUTH.id);
    expect(uploads[0][1].endpoint).toBe('https://oss-cn-hangzhou.aliyuncs.com');
    expect(uploads[0][1].requestpaystatus).toBe('NO');

    console.log('UPLOADS-DIAG:', store.uploads.map((t) => [t.taskId, t.from && t.from.name, t.status]));
    expect(store.uploads.length).toBe(2);
    // 并发调度：waiting → resume
    const resumes = transferCalls.filter((c) => c[0] === 'resume');
    expect(resumes.length).toBe(2);
  });

  it('请求者付费：auth.requestpaystatus=YES 透传到 createUpload/request pay 开关', async () => {
    const store = await seedStore();
    const { useAuthStore } = await import('@renderer/stores/auth.js');
    useAuthStore().info = Object.assign({}, AUTH, { requestpaystatus: 'YES' });
    await store.createUploadJobs(['C:/local/dir'], { region: 'oss-cn-hangzhou', bucket: 'demo-b', key: 'root/' });
    const uploads = transferCalls.filter((c) => c[0] === 'createUpload');
    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads[0][1].requestpaystatus).toBe('YES');
  });

  it('STS 账号 endpoint 注入 securityToken', async () => {
    const store = await seedStore();
    const { useAuthStore } = await import('@renderer/stores/auth.js');
    useAuthStore().info = { id: 'STS.abc', secret: 'sk', stoken: 'tok-1', eptpl: 'https://{region}.aliyuncs.com' };
    await store.createUploadJobs(['C:/f.txt'], { region: 'oss-cn-hangzhou', bucket: 'demo-b', key: '' });
    const upload = transferCalls.find((c) => c[0] === 'createUpload');
    expect(upload[1].securityToken).toBe('tok-1');
  });

  it('并发上限 maxUploadJobCount=3：5 个 waiting 仅 3 个 resume', async () => {
    const store = await seedStore();
    useSettingsStore().maxUploadJobCount = 3;
    await store.createUploadJobs(['C:/one'], { region: 'r', bucket: 'b', key: '' });
    // scanFolder mock 固定返回 2 文件；补 3 个手工任务
    store.uploads.forEach((t) => { t.status = 'waiting'; });
    store.concurrency = 0;
    transferCalls.length = 0;
    for (let i = 0; i < 3; i++) {
      store.pushTask('manual-' + i, { region: 'r', from: { name: 'm' + i }, to: { bucket: 'b', key: 'm' + i } });
    }
    const resumes = transferCalls.filter((c) => c[0] === 'resume');
    expect(resumes.length).toBe(3);
    expect(store.uploads.filter((t) => t.status === 'waiting').length).toBe(2);
  });
});

describe('transfer store：广播与调度回流', () => {
  it('onPayload 更新进度/状态；running→stopped 时 concurrency 递减', async () => {
    const store = await seedStore();
    await store.createUploadJobs(['C:/one'], { region: 'r', bucket: 'b', key: '' });
    const task = store.uploads[0];
    store.concurrency = 2;

    progressCb({ taskId: task.taskId, status: 'running', prog: { loaded: 5, total: 10 }, speed: 1024 });
    expect(task.status).toBe('running');
    expect(task.speed).toBe(1024);

    progressCb({ taskId: task.taskId, status: 'stopped', prog: { loaded: 5, total: 10 } });
    expect(task.status).toBe('stopped');
    expect(store.concurrency).toBe(1);

    progressCb({ taskId: task.taskId, status: 'finished', prog: { loaded: 10, total: 10 } });
    expect(task.status).toBe('finished');
    expect(task.prog.loaded).toBe(10);
  });

  it('失败任务携带 ecCode/requestId/message；retry 换新 taskId 并回到 waiting', async () => {
    const store = await seedStore();
    await store.createUploadJobs(['C:/one'], { region: 'r', bucket: 'b', key: '' });
    const task = store.uploads[0];
    progressCb({ taskId: task.taskId, status: 'failed', message: 'boom', ecCode: 'E1', requestId: 'R1' });
    expect(task.status).toBe('failed');
    expect(task.ecCode).toBe('E1');
    expect(task.requestId).toBe('R1');

    const detail = await store.errorDetail(task.taskId);
    expect(detail.message).toBe('boom');

    await store.retry(task.taskId);
    expect(task.taskId).toBe('up-retry');
    expect(task.status).toBe('waiting');
    expect(task.message).toBe('');
  });
});

describe('transfer store：控制与清理', () => {
  it('pause/resume/remove/clearCompleted/clearAll/startAll', async () => {
    const store = await seedStore();
    await store.createUploadJobs(['C:/one'], { region: 'r', bucket: 'b', key: '' });
    const [t1, t2] = store.uploads;

    store.pause(t1.taskId);
    expect(transferCalls.some((c) => c[0] === 'pause' && c[1] === t1.taskId)).toBe(true);
    store.resume(t1.taskId);
    expect(transferCalls.some((c) => c[0] === 'resume' && c[1] === t1.taskId)).toBe(true);

    t2.status = 'finished';
    store.clearCompleted();
    expect(store.uploads.length).toBe(1);

    t1.status = 'stopped';
    store.startAll();
    // startAll → checkStart → resume，主进程广播 running（状态由事件驱动）
    expect(t1.status).toBe('running');

    store.clearAll();
    expect(store.uploads.length).toBe(0);

    installTransfer({});
    await store.createUploadJobs(['C:/two'], { region: 'r', bucket: 'b', key: '' });
    const target = store.uploads[0];
    await store.remove(target.taskId);
    expect(store.uploads.length).toBe(1);
    expect(transferCalls.some((c) => c[0] === 'clear')).toBe(true);
  });

  it('进度持久化：1s 防抖写 upprog_ 脱敏命名；loadProgress 恢复为暂停态', async () => {
    const store = await seedStore();
    useSettingsStore();
    // setup.js 的 digest stub 为 padEnd 简化实现（保留原文前缀），此处用真实 sha256 验证脱敏语义
    const { createHash } = await import('node:crypto');
    window.ossBrowser.digest = {
      sha256Hex: (text) => ({
        ok: true,
        data: createHash('sha256').update(String(text || '')).digest('hex'),
      }),
    };
    const writes = [];
    window.ossBrowser.storage.writeProgress = (name, content) => {
      writes.push({ name, content });
      return Promise.resolve({ ok: true, data: true });
    };
    await store.createUploadJobs(['C:/one'], { region: 'r', bucket: 'b', key: '' });

    vi.useFakeTimers();
    store.saveProgress();
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
    await flushPromises();
    expect(writes.length).toBe(1);
    expect(/^upprog_.+\.json$/.test(writes[0].name)).toBe(true);
    // 脱敏红线：文件名不得含明文 AK
    expect(writes[0].name.indexOf('LTAI5tTest')).toBe(-1);
    const list = JSON.parse(writes[0].content);
    expect(list.length).toBe(2);
    expect(list[0].to.key).toBeDefined();

    // loadProgress：从持久化内容恢复 → 恢复后暂停
    const store2Pinia = createPinia();
    setActivePinia(store2Pinia);
    const { useAuthStore } = await import('@renderer/stores/auth.js');
    useAuthStore().info = AUTH;
    window.ossBrowser.storage.readProgress = (name) => {
      // 新名命中返回持久化内容；legacy 名返回不存在
      if (writes[0] && name === writes[0].name) {
        return Promise.resolve({ ok: true, data: { exists: true, content: writes[0].content } });
      }
      return Promise.resolve({ ok: true, data: { exists: false, content: '' } });
    };
    transferCalls = [];
    const store2 = useTransferStore();
    store2.subscribe();
    await store2.loadProgress();
    expect(store2.uploads.length).toBe(2);
    expect(store2.uploads[0].status).toBe('stopped');
    expect(transferCalls.some((c) => c[0] === 'pause')).toBe(true);
  });
});

describe('DropZone：拖拽高亮与取路径', () => {
  it('drop 经 getPathForFile emit 绝对路径；无路径项被过滤', async () => {
    window.ossBrowser.system = {
      getPathForFile: (f) => (f && f.name === 'ok.txt' ? 'C:/tmp/ok.txt' : ''),
    };
    const wrapper = mountWith(DropZone);
    await wrapper.trigger('dragenter');
    expect(wrapper.find('[data-testid="drop-overlay"]').exists()).toBe(true);

    const dt = { files: [{ name: 'ok.txt' }, { name: 'bad.txt' }] };
    await wrapper.trigger('drop', { dataTransfer: dt });
    expect(wrapper.find('[data-testid="drop-overlay"]').exists()).toBe(false);
    expect(wrapper.emitted('dropped')[0]).toEqual([['C:/tmp/ok.txt']]);
  });
});

describe('FileDialogButton：选择属性与回调', () => {
  it('isFolder → openDirectory+multiSelections；选中后 emit picked', async () => {
    const calls = [];
    window.ossBrowser.system = {
      showOpenDialog: (opts) => {
        calls.push(opts);
        return Promise.resolve({ ok: true, data: { canceled: false, filePaths: ['C:/dir'] } });
      },
    };
    const wrapper = mountWith(FileDialogButton, { isFolder: true });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(calls[0].properties).toEqual(['openDirectory', 'multiSelections']);
    expect(wrapper.emitted('picked')[0]).toEqual([['C:/dir']]);
  });

  it('取消选择不 emit', async () => {
    window.ossBrowser.system = {
      showOpenDialog: () => Promise.resolve({ ok: true, data: { canceled: true, filePaths: [] } }),
    };
    const wrapper = mountWith(FileDialogButton);
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('picked')).toBeFalsy();
  });
});

describe('UploadsPanel：行渲染与操作', () => {
  it('渲染任务行（名称/大小/百分比）；筛选与清空已完成/清空所有', async () => {
    const store = await seedStore();
    await store.createUploadJobs(['C:/one'], { region: 'r', bucket: 'b', key: '' });
    store.uploads[0].prog = { loaded: 5, total: 10 };
    store.uploads[0].status = 'running';
    store.uploads[0].speed = 2048;
    store.uploads[1].status = 'failed';
    store.uploads[1].message = 'boom';
    const wrapper = mountWith(UploadsPanel);
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="upload-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].text()).toContain('a.txt');
    expect(rows[0].text()).toContain('50%');
    expect(rows[0].find('[data-testid="upload-row-pause"]').exists()).toBe(true);
    expect(rows[1].find('[data-testid="upload-row-message"]').exists()).toBe(true);

    await wrapper.find('[data-testid="uploads-filter-failed"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="upload-row"]').length).toBe(1);

    store.searchText = '';
    store.uploads[0].status = 'finished';
    const ui = useUiStore();
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(true);
    await wrapper.find('[data-testid="uploads-clear-finished"]').trigger('click');
    await flushPromises();
    expect(store.uploads.length).toBe(1);

    await wrapper.find('[data-testid="uploads-clear-all"]').trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalled();
    expect(store.uploads.length).toBe(0);
  });
});