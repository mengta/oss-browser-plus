// 预览/详情共用：选择本地下载目录 → 创建下载任务并展示传输中心。
// 等价 Dialog.showDownloadDialog + FilesPage.uploadFromPaths 的下载侧语义（B3-07）。
import { useTransferStore } from '../stores/transfer.js';

export async function pickDownloadFolder(items, bucketInfo) {
  if (!items || items.length === 0 || !bucketInfo || !bucketInfo.bucket) {
    return { ok: false, canceled: true };
  }
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (!system || typeof system.showOpenDialog !== 'function') {
    return { ok: false, canceled: true };
  }
  try {
    const res = await system.showOpenDialog({ title: 'Download', properties: ['openDirectory'] });
    const data = res && res.ok ? res.data : null;
    if (!data || data.canceled || !data.filePaths || data.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    const toLocal = String(data.filePaths[0]).replace(/[\\/]+$/, '');
    const transferStore = useTransferStore();
    await transferStore.createDownloadJobs(items, toLocal, bucketInfo);
    transferStore.setVisible(true, 'download');
    return { ok: true };
  } catch (err) {
    return { ok: false, canceled: true };
  }
}