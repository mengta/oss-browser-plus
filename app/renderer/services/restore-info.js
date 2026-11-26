// 等价 ossSvs2.parseRestoreInfo（原为主进程暴露方法，B3-10 改为渲染层纯函数）
export function parseRestoreInfo(header) {
  const text = String(header || '');
  const arr = text.match(/([\w-]+)="([^"]+)"/g) || [];
  const info = {};
  for (const pair of arr) {
    const kv = pair.match(/([\w-]+)="([^"]+)"/);
    if (kv) info[kv[1]] = kv[2];
  }
  return info;
}

// 由 HEAD 元信息推导恢复状态：type 1=未恢复请求 2=恢复中 3=已恢复可读
export function restoreStateOf(meta) {
  const data = meta || {};
  if (!data.Restore) {
    return { type: 1, expiryDate: '' };
  }
  const info = parseRestoreInfo(data.Restore);
  if (info['ongoing-request'] === 'true') {
    return { type: 2, expiryDate: '' };
  }
  return { type: 3, expiryDate: info['expiry-date'] || '' };
}

// 恢复完成后把最新恢复状态写回列表对象（原版由主进程 loadStorageStatus 就地更新）
export async function applyRestoreState(ossClient, currentInfo, items) {
  const info = currentInfo || {};
  const list = Array.isArray(items) ? items : [items];
  for (const item of list) {
    if (!item || !item.path) continue;
    try {
      const meta = await ossClient.getFileInfo(info.region, info.bucket, item.path);
      const state = restoreStateOf(meta);
      item.storageStatus = state.type;
      if (state.expiryDate) item.expired_time = state.expiryDate;
    } catch (err) {
      /* 单对象状态刷新失败不阻断其余 */
    }
  }
}