import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { pickDownloadFolder } from '@renderer/services/file-actions.js';
import { useTransferStore } from '@renderer/stores/transfer.js';

const items = [{ path: 'folder/a.txt', size: 10 }];
const bucketInfo = { bucket: 'bucket-a', region: 'cn-hangzhou' };

let originalSystem;

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  originalSystem = window.ossBrowser.system;
  window.ossBrowser.system = {
    ...originalSystem,
    showOpenDialog: vi.fn(() => Promise.resolve({ ok: true, data: { canceled: false, filePaths: ['C:/downloads/'] } })),
  };
});

describe('file-actions.pickDownloadFolder 前置校验', () => {
  it('未选择对象时直接取消，不打开目录对话框', async () => {
    const spy = vi.spyOn(window.ossBrowser.system, 'showOpenDialog');

    await expect(pickDownloadFolder([], bucketInfo)).resolves.toEqual({ ok: false, canceled: true });
    await expect(pickDownloadFolder(null, bucketInfo)).resolves.toEqual({ ok: false, canceled: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it('缺少 bucket 信息时取消', async () => {
    await expect(pickDownloadFolder(items, {})).resolves.toEqual({ ok: false, canceled: true });
    await expect(pickDownloadFolder(items, null)).resolves.toEqual({ ok: false, canceled: true });
  });

  it('桥接缺少 showOpenDialog 时取消', async () => {
    window.ossBrowser.system = {};

    await expect(pickDownloadFolder(items, bucketInfo)).resolves.toEqual({ ok: false, canceled: true });
  });
});

describe('file-actions.pickDownloadFolder 目录选择', () => {
  it('用户取消或未返回路径时视为取消', async () => {
    window.ossBrowser.system.showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: true, filePaths: ['C:/x'] } }));
    await expect(pickDownloadFolder(items, bucketInfo)).resolves.toEqual({ ok: false, canceled: true });

    window.ossBrowser.system.showOpenDialog = vi.fn(() =>
      Promise.resolve({ ok: true, data: { canceled: false, filePaths: [] } }));
    await expect(pickDownloadFolder(items, bucketInfo)).resolves.toEqual({ ok: false, canceled: true });

    window.ossBrowser.system.showOpenDialog = vi.fn(() => Promise.resolve({ ok: false, code: 'IO' }));
    await expect(pickDownloadFolder(items, bucketInfo)).resolves.toEqual({ ok: false, canceled: true });
  });

  it('选择目录后创建下载任务并打开传输中心', async () => {
    const store = useTransferStore();
    const createDownloadJobs = vi.spyOn(store, 'createDownloadJobs').mockResolvedValue([]);

    await expect(pickDownloadFolder(items, bucketInfo)).resolves.toEqual({ ok: true });

    expect(window.ossBrowser.system.showOpenDialog).toHaveBeenCalledWith({
      title: 'Download',
      properties: ['openDirectory'],
    });
    expect(createDownloadJobs).toHaveBeenCalledWith(items, 'C:/downloads', bucketInfo);
    expect(store.visible).toBe(true);
    expect(store.activeTab).toBe('download');
  });

  it('创建任务过程抛错时降级为取消', async () => {
    const store = useTransferStore();
    vi.spyOn(store, 'createDownloadJobs').mockRejectedValue(new Error('mkdir failed'));

    await expect(pickDownloadFolder(items, bucketInfo)).resolves.toEqual({ ok: false, canceled: true });
  });
});