import { useAuthStore } from '../stores/auth.js';
import { useFilesStore } from '../stores/files.js';
import { useFavoritesStore } from '../stores/favorites.js';
import { useTransferStore } from '../stores/transfer.js';

// 登出/切换账号的统一清理：先停止后台传输，再清空按账号隔离的收藏与列表缓存，
// 避免旧账号任务继续运行或收藏数据串到新账号。
export function clearUserSession() {
  const transfer = useTransferStore();
  transfer.stopAll('upload');
  transfer.stopAll('download');
  transfer.reset();
  useFavoritesStore().reset();
  useAuthStore().remove();
  useFilesStore().reset();
}

export default { clearUserSession };