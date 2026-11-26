// B4-05：升级链路渲染层服务（封装 upgrade 白名单；清单不可达静默）
import { api, subscribeUpgrade } from './api.js';

function toError(res, fallback) {
  const err = new Error((res && res.message) || fallback);
  err.code = (res && res.code) || 'INTERNAL';
  return err;
}

export const upgradeService = {
  async check() {
    const res = await api.upgrade.check();
    if (res && res.ok) return res.data;
    if (res && res.code === 'UNAVAILABLE') return null;
    throw toError(res, 'upgrade check failed');
  },

  async download(payload) {
    const res = await api.upgrade.download(payload || {});
    if (res && res.ok) return res.data;
    throw toError(res, 'upgrade download failed');
  },

  async install(payload) {
    const res = await api.upgrade.install(payload || {});
    if (res && res.ok) return true;
    throw toError(res, 'upgrade install failed');
  },

  subscribe(handler) {
    if (typeof handler !== 'function') return () => false;
    return subscribeUpgrade((payload) => handler(payload));
  },

  // 启动检测（autoUpgrade 开启时调用）：失败静默，仅更新顶栏角标
  async checkAndUpdate(ui) {
    try {
      const data = await this.check();
      if (!data) return null;
      if (ui && typeof ui.setUpgrade === 'function') {
        ui.setUpgrade({ hasNew: !!data.hasNew, version: data.version || '', state: 'idle' });
      }
      return data;
    } catch (err) {
      return null;
    }
  },

  // 关于页共享状态（下载进度/安装就绪/失败提示）
  track(ui) {
    return this.subscribe((payload) => {
      if (!payload || !ui || typeof ui.setUpgrade !== 'function') return;
      const info = payload.info || {};
      ui.setUpgrade({
        state: payload.state || ui.upgrade.state,
        hasNew: info.hasNew != null ? !!info.hasNew : ui.upgrade.hasNew,
        version: info.version || ui.upgrade.version,
        progress: typeof info.progress === 'number' ? info.progress : ui.upgrade.progress,
        message: info.message || '',
      });
    });
  },
};

export default upgradeService;