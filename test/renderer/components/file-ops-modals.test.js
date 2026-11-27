import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import DeleteFilesModal from '@renderer/components/business/modals/DeleteFilesModal.vue';
import AddFolderModal from '@renderer/components/business/modals/AddFolderModal.vue';
import RenameModal from '@renderer/components/business/modals/RenameModal.vue';
import MoveModal from '@renderer/components/business/modals/MoveModal.vue';
import FilesPage from '@renderer/pages/FilesPage.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import { useUiStore } from '@renderer/stores/ui.js';
import { useFilesStore } from '@renderer/stores/files.js';
import { useAuthStore } from '@renderer/stores/auth.js';
import { useToastStore } from '@renderer/stores/toast.js';

// B3-09：文件操作弹窗（删除 / 新建目录 / 重命名 / 复制移动 / 粘贴链路）契约

let calls = [];

function installOss(overrides) {
  calls = [];
  const base = {
    listAllBuckets: () => Promise.resolve({ ok: true, data: [] }),
    listFiles: () => Promise.resolve({ ok: true, data: { data: [], marker: null } }),
    createFolder: (auth, region, bucket, prefix) => {
      calls.push(['createFolder', region, bucket, prefix]);
      return Promise.resolve({ ok: true, data: {} });
    },
    checkFileExists: (auth, region, bucket, key) => {
      calls.push(['checkFileExists', key]);
      return Promise.reject(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }));
    },
    checkFolderExists: (auth, region, bucket, prefix) => {
      calls.push(['checkFolderExists', prefix]);
      return Promise.resolve({ ok: true, data: false });
    },
    moveFile: (auth, region, bucket, from, to, isCopy) => {
      calls.push(['moveFile', from, to, isCopy]);
      return Promise.resolve({ ok: true, data: {} });
    },
    copyFiles: (auth, region, items, target, cb, removeAfterCopy, renameKey) => {
      calls.push(['copyFiles', region, items, target, removeAfterCopy, renameKey]);
      if (typeof cb === 'function') cb({ current: 1, total: 2, errorCount: 0 });
      return Promise.resolve({ ok: true, data: [] });
    },
    stopCopyFiles: () => {
      calls.push(['stopCopyFiles']);
      return Promise.resolve({ ok: true, data: true });
    },
    deleteFiles: (auth, region, bucket, items, cb) => {
      calls.push(['deleteFiles', region, bucket, items]);
      if (typeof cb === 'function') cb({ current: 1, total: 2, errorCount: 0 });
      return Promise.resolve({ ok: true, data: [] });
    },
    stopDeleteFiles: () => {
      calls.push(['stopDeleteFiles']);
      return Promise.resolve({ ok: true, data: true });
    },
  };
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = Object.assign(base, overrides || {});
}

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

const CURRENT_INFO = { region: 'r', bucket: 'b', key: 'pre/' };
const ITEMS = [
  { name: 'a.txt', path: 'pre/a.txt', isFile: true },
  { name: 'dir', path: 'pre/dir/', isFolder: true },
];

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.ossBrowser = window.ossBrowser || {};
  delete window.ossBrowser.oss;
  vi.restoreAllMocks();
});

describe('DeleteFilesModal：确认 → 进度 → 结果', () => {
  it('step1 展示清单；确认后删除（region/bucket/items/进度回调）→ 成功视图', async () => {
    installOss({});
    const wrapper = mountWith(DeleteFilesModal, { items: ITEMS, currentInfo: CURRENT_INFO });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="delete-files-item"]').length).toBe(2);
    expect(wrapper.find('[data-testid="delete-files-confirm"]').exists()).toBe(true);

    await wrapper.find('[data-testid="delete-files-confirm"]').trigger('click');
    await flushPromises();

    const deleteCall = calls.find((c) => c[0] === 'deleteFiles');
    expect(deleteCall[1]).toBe('r');
    expect(deleteCall[2]).toBe('b');
    expect(deleteCall[3]).toEqual([
      { path: 'pre/a.txt', name: 'a.txt', isFolder: false, isFile: true },
      { path: 'pre/dir/', name: 'dir', isFolder: true, isFile: false },
    ]);
    expect(wrapper.find('[data-testid="delete-files-success"]').text()).toContain('删除成功');
    expect(wrapper.text()).toContain('1 / 2');
  });

  it('失败明细最多展示 10 条 + 截断标记（PARTIAL_FAILURE.failures）', async () => {
    const failures = Array.from({ length: 12 }, (_, i) => ({
      item: { path: 'pre/f' + i + '.txt', isFolder: false },
      message: 'denied ' + i,
    }));
    installOss({
      deleteFiles: () =>
        Promise.reject(
          Object.assign(new Error('PARTIAL_FAILURE'), { code: 'PARTIAL_FAILURE', failures })
        ),
    });
    const wrapper = mountWith(DeleteFilesModal, { items: ITEMS, currentInfo: CURRENT_INFO });
    await flushPromises();
    await wrapper.find('[data-testid="delete-files-confirm"]').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('[data-testid="delete-files-failure"]').length).toBe(10);
    expect(wrapper.find('[data-testid="delete-files-failures"]').text()).toContain('部分目录或文件无法删除');
    expect(wrapper.find('[data-testid="delete-files-failures"]').text()).toContain('......');
    expect(wrapper.find('[data-testid="delete-files-success"]').exists()).toBe(false);
  });

  it('同步异常不卡在进度页，转为失败结果', async () => {
    installOss({
      deleteFiles: () => {
        throw new Error('clone failed');
      },
    });
    const wrapper = mountWith(DeleteFilesModal, { items: ITEMS, currentInfo: CURRENT_INFO });
    await flushPromises();
    await wrapper.find('[data-testid="delete-files-confirm"]').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('[data-testid="delete-files-failure"]').length).toBe(1);
    expect(wrapper.find('[data-testid="delete-files-failure"]').html()).toContain('clone failed');
    expect(wrapper.find('[data-testid="delete-files-success"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="delete-files-close"]').exists()).toBe(true);
  });

  it('停止按钮调 stopDeleteFiles 并禁用', async () => {
    installOss({ deleteFiles: () => new Promise(() => {}) });
    const wrapper = mountWith(DeleteFilesModal, { items: ITEMS, currentInfo: CURRENT_INFO });
    await flushPromises();
    await wrapper.find('[data-testid="delete-files-confirm"]').trigger('click');
    await flushPromises();

    const stopBtn = wrapper.find('[data-testid="delete-files-stop"]');
    await stopBtn.trigger('click');
    await flushPromises();
    expect(calls.some((c) => c[0] === 'stopDeleteFiles')).toBe(true);
    expect(stopBtn.attributes('disabled')).toBeDefined();
  });
});

describe('AddFolderModal：目录名校验与创建', () => {
  it('含 / 不提交；合法名 createFolder(key+name+/) 并关闭', async () => {
    installOss({});
    const wrapper = mountWith(AddFolderModal, { currentInfo: CURRENT_INFO });
    await flushPromises();

    await wrapper.find('[data-testid="add-folder-name"]').setValue('a/b');
    await wrapper.find('[data-testid="add-folder-submit"]').trigger('click');
    await flushPromises();
    expect(calls.length).toBe(0);
    expect(wrapper.emitted('close')).toBeUndefined();

    await wrapper.find('[data-testid="add-folder-name"]').setValue('newdir');
    await wrapper.find('[data-testid="add-folder-submit"]').trigger('click');
    await flushPromises();
    expect(calls).toContainEqual(['createFolder', 'r', 'b', 'pre/newdir/']);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });
});

describe('RenameModal：文件/目录重命名与覆盖确认', () => {
  it('文件目标不存在（check 失败）→ 直接 moveFile(isCopy=false) 并关闭', async () => {
    installOss({});
    const wrapper = mountWith(RenameModal, {
      item: { name: 'a.txt', path: 'pre/a.txt', isFile: true },
      moveTo: CURRENT_INFO,
      currentInfo: CURRENT_INFO,
      isCopy: false,
    });
    expect(wrapper.find('[data-testid="rename-submit"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="rename-name"]').setValue('b.txt');
    await wrapper.find('[data-testid="rename-submit"]').trigger('click');
    await flushPromises();

    expect(calls).toContainEqual(['moveFile', 'pre/a.txt', 'pre/b.txt', false]);
    expect(wrapper.emitted('close')[0]).toEqual([true]);
  });

  it('文件同名：确认取消不重命名；确认后 moveFile', async () => {
    installOss({
      checkFileExists: (auth, region, bucket, key) => {
        calls.push(['checkFileExists', key]);
        return Promise.resolve({ ok: true, data: {} });
      },
    });
    const ui = useUiStore();
    const confirmSpy = vi.spyOn(ui, 'confirm').mockResolvedValue(false);
    const wrapper = mountWith(RenameModal, {
      item: { name: 'a.txt', path: 'pre/a.txt', isFile: true },
      moveTo: CURRENT_INFO,
      currentInfo: CURRENT_INFO,
      isCopy: false,
    });

    await wrapper.find('[data-testid="rename-name"]').setValue('b.txt');
    await wrapper.find('[data-testid="rename-submit"]').trigger('click');
    await flushPromises();
    expect(confirmSpy).toHaveBeenCalled();
    expect(calls.some((c) => c[0] === 'moveFile')).toBe(false);

    confirmSpy.mockResolvedValue(true);
    await wrapper.find('[data-testid="rename-submit"]').trigger('click');
    await flushPromises();
    expect(calls).toContainEqual(['moveFile', 'pre/a.txt', 'pre/b.txt', false]);
  });

  it('目录无冲突 → 打开 move 弹窗并携带 renamePath（嵌套深度 ≤2）', async () => {
    installOss({});
    const ui = useUiStore();
    const openSpy = vi.spyOn(ui, 'open').mockResolvedValue(null);
    const wrapper = mountWith(RenameModal, {
      item: { name: 'dir', path: 'pre/dir/', isFolder: true },
      moveTo: CURRENT_INFO,
      currentInfo: CURRENT_INFO,
      isCopy: false,
    });

    await wrapper.find('[data-testid="rename-name"]').setValue('dir2');
    await wrapper.find('[data-testid="rename-submit"]').trigger('click');
    await flushPromises();

    expect(openSpy.mock.calls[0][0]).toBe('move');
    expect(openSpy.mock.calls[0][1].renamePath).toBe('pre/dir2/');
    expect(openSpy.mock.calls[0][1].isCopy).toBe(false);
  });
});

describe('MoveModal：打开即复制/移动 + 进度 + 失败明细', () => {
  const MOVE_ITEMS = [
    { name: 'a.txt', path: 'pre/a.txt', isFile: true },
    { name: 'd', path: 'pre/d/', isFolder: true },
  ];

  it('copyFiles 参数（from.region/items.bucket/目标/removeAfterCopy/renamePath）+ onComplete', async () => {
    const done = vi.fn();
    installOss({
      copyFiles: (auth, region, items, target, cb, removeAfterCopy, renameKey) => {
        calls.push(['copyFiles', region, items, target, removeAfterCopy, renameKey]);
        if (typeof cb === 'function') cb({ current: 1, total: 2, errorCount: 1 });
        return Promise.resolve({
          ok: true,
          data: [{ item: { path: 'pre/a.txt', isFolder: false }, error: new Error('nope') }],
        });
      },
    });
    const wrapper = mountWith(MoveModal, {
      items: MOVE_ITEMS,
      moveTo: { region: 'r2', bucket: 'dst', key: 'dst/' },
      fromInfo: { region: 'r', bucket: 'src', key: 'pre/' },
      isCopy: true,
      renamePath: '',
      onComplete: done,
    });
    await flushPromises();

    const call = calls.find((c) => c[0] === 'copyFiles');
    expect(call[1]).toBe('r');
    expect(call[2].every((i) => i.bucket === 'src')).toBe(true);
    expect(call[3]).toEqual({ region: 'r2', bucket: 'dst', key: 'dst/' });
    expect(call[4]).toBe(false);
    expect(call[5]).toBe('');
    expect(wrapper.text()).toContain('1 / 2');
    expect(wrapper.find('[data-testid="move-failures"]').text()).toContain('部分目录或文件无法复制：');
    expect(wrapper.find('[data-testid="move-success"]').exists()).toBe(false);
    expect(done).toHaveBeenCalled();
  });

  it('移动模式 removeAfterCopy=true；停止按钮调 stopCopyFiles', async () => {
    installOss({ copyFiles: (auth, region, items, target, cb, removeAfterCopy, renameKey) => {
        calls.push(['copyFiles', region, items, target, removeAfterCopy, renameKey]);
        return new Promise(() => {});
      } });
    const wrapper = mountWith(MoveModal, {
      items: MOVE_ITEMS,
      moveTo: { region: 'r2', bucket: 'dst', key: 'dst/' },
      fromInfo: { region: 'r', bucket: 'src', key: 'pre/' },
      isCopy: false,
      renamePath: '',
    });
    await flushPromises();
    const call = calls.find((c) => c[0] === 'copyFiles');
    expect(call[4]).toBe(true);

    const stopBtn = wrapper.find('[data-testid="move-stop"]');
    await stopBtn.trigger('click');
    await flushPromises();
    expect(calls.some((c) => c[0] === 'stopCopyFiles')).toBe(true);
    expect(stopBtn.attributes('disabled')).toBeDefined();
  });
});

describe('FilesPage：复制/移动暂存与粘贴', () => {
  function mountPage() {
    installOss({});
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore(pinia);
    auth.info = { id: 'LTAI', secret: 'sk' };
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

  function select(files, items, pinia) {
    files.items = items;
    files.selectedList = items;
    return flushPromises().then(() => {
      setActivePinia(pinia);
    });
  }

  it('复制单个对象 → 出现粘贴(n) → 粘贴走 rename（同 Bucket 可改名）', async () => {
    const { wrapper, files, pinia } = mountPage();
    await flushPromises();
    const item = { name: 'a.txt', path: 'pre/a.txt', isFile: true };
    await select(files, [item], pinia);

    const ui = useUiStore(pinia);
    const openSpy = vi.spyOn(ui, 'open');
    await wrapper.find('[data-testid="file-copy"]').trigger('click');
    await flushPromises();

    const pasteBtn = wrapper.find('[data-testid="file-paste"]');
    expect(pasteBtn.exists()).toBe(true);
    expect(pasteBtn.text()).toContain('(1)');

    await pasteBtn.trigger('click');
    await flushPromises();
    expect(openSpy.mock.calls[0][0]).toBe('rename');
    expect(openSpy.mock.calls[0][1].moveTo).toEqual({ region: 'r', bucket: 'b', key: 'pre/' });
    expect(openSpy.mock.calls[0][1].isCopy).toBe(true);
  });

  it('多对象移动粘贴：同目录先提示 forbidden（不弹确认）', async () => {
    const { wrapper, files, pinia } = mountPage();
    await flushPromises();
    const items = [
      { name: 'a.txt', path: 'pre/a.txt', isFile: true },
      { name: 'c.txt', path: 'pre/c.txt', isFile: true },
    ];
    await select(files, items, pinia);

    const toast = useToastStore(pinia);
    const toastSpy = vi.spyOn(toast, 'push');
    await wrapper.find('[data-testid="file-more"] > button').trigger('click');
    await wrapper.find('[data-testid="more-move"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="file-paste"]').trigger('click');
    await flushPromises();

    expect(toastSpy.mock.calls.some((c) => String(c[0]).indexOf('不支持在当前路径') === 0)).toBe(true);
  });

  it('多对象复制粘贴：确认后打开 move 弹窗（目标=当前目录）', async () => {
    const { wrapper, files, pinia } = mountPage();
    await flushPromises();
    const items = [
      { name: 'a.txt', path: 'pre/a.txt', isFile: true },
      { name: 'c.txt', path: 'pre/c.txt', isFile: true },
    ];
    await select(files, items, pinia);

    const ui = useUiStore(pinia);
    vi.spyOn(ui, 'confirm').mockResolvedValue(true);
    const openSpy = vi.spyOn(ui, 'open');
    await wrapper.find('[data-testid="file-copy"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="file-paste"]').trigger('click');
    await flushPromises();

    expect(openSpy.mock.calls[0][0]).toBe('move');
    expect(openSpy.mock.calls[0][1].items.length).toBe(2);
    expect(openSpy.mock.calls[0][1].isCopy).toBe(true);
  });
});