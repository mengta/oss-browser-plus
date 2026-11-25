// B3-06：传输 store（上传链路；下载由 B3-07 在本 store 上扩展 downloads 侧）
// 等价 Angular ossUploadManager 状态语义：
// - 任务列表 uploads[]（status: waiting/running/stopped/failed/finished/retrying/verifying）
// - 并发调度 checkStart（maxUploadJobCount）+ 停止创建 stopCreating
// - 进度持久化 saveProgress（upprog_ 脱敏命名 + 1s 防抖；loadProgress 含 legacy 兼容读）
// - 广播订阅 transfer:progress（onPayload 更新 status/prog/speed/checkPoints + 调度回流）
// - 目录递归经主进程 transfer.scanFolder（O-14，渲染层无 fs）
import { defineStore } from 'pinia';
import { newProgFileName, legacyProgFileName } from '../services/prog-naming.js';
import { ossClient } from '../services/oss-client.js';
import { useSettingsStore } from './settings.js';
import { useAuthStore } from './auth.js';

const SAVE_PROG_PREFIX = 'upprog_';

function transferApi() {
  return typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.transfer : null;
}

function storageApi() {
  return typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.storage : null;
}

function unwrap(res) {
  return res && res.ok ? res.data : null;
}

function buildAuthPayload(auth, region, eptpl) {
  const ept = eptpl || 'https://{region}.aliyuncs.com';
  const endpoint = ept.replace('{region}', region || 'oss-cn-hangzhou');
  const p = {
    accessKeyId: auth.id,
    accessKeySecret: auth.secret,
    endpoint,
  };
  if (auth.stoken && String(auth.id).indexOf('STS.') === 0) {
    p.securityToken = auth.stoken;
  }
  return p;
}

function joinKey(prefix, relative) {
  const p = String(prefix || '').replace(/\/+$/, '');
  return p ? p + '/' + relative : relative;
}

export const useTransferStore = defineStore('transfer', {
  state: () => ({
    uploads: [],
    downloads: [],
    subscribed: false,
    concurrency: 0,
    retryTimes: 0,
    visible: false,
    activeTab: 'upload',
    stopCreating: false,
    searchText: '',
    lastErrorDetail: null,
  }),

  getters: {
    uploadRunning: (state) => state.uploads.filter((t) => t.status === 'running').length,
    uploadStopped: (state) => state.uploads.filter((t) => t.status === 'stopped').length,
    uploadFailed: (state) => state.uploads.filter((t) => t.status === 'failed').length,
    uploadDone: (state) => state.uploads.filter((t) => t.status === 'finished').length,
    activeCount: (state) => state.uploads.length + state.downloads.length,
  },

  actions: {
    // ---------- 订阅 / 初始化 ----------
    subscribe() {
      if (this.subscribed) return;
      const api = transferApi();
      if (!api || typeof api.subscribe !== 'function') return;
      this.subscribed = true;
      api.subscribe((payload) => this.onPayload(payload));
    },

    init() {
      this.subscribe();
      this.concurrency = 0;
      this.retryTimes = 0;
      if (this.uploads.length === 0) {
        return this.loadProgress().then(() => this.checkStart());
      }
      return Promise.resolve(this.uploads);
    },

    // ---------- 广播驱动 ----------
    onPayload(payload) {
      if (!payload || !payload.taskId) return;
      const task = this.uploads.find((t) => t.taskId === payload.taskId);
      if (!task) return;
      const prev = task.status;
      task.status = payload.status || prev;
      if (payload.prog) {
        task.prog = { loaded: payload.prog.loaded || 0, total: payload.prog.total || task.prog.total };
      }
      if (typeof payload.speed === 'number') task.speed = payload.speed;
      task.message = payload.message || task.message || '';
      task.ecCode = payload.ecCode || '';
      task.requestId = payload.requestId || '';
      if (payload.checkPoints) task.checkPoints = payload.checkPoints;
      if (typeof payload.retryTimes === 'number') task.retryTimes = payload.retryTimes;

      const terminal = ['stopped', 'failed', 'finished'].indexOf(task.status) !== -1;
      if (prev !== task.status && terminal) {
        this.concurrency = Math.max(0, this.concurrency - 1);
        setTimeout(() => this.checkStart(), 100);
      }
      if (task.status === 'finished') {
        task.prog = { loaded: task.prog.total, total: task.prog.total };
      }
      this.saveProgress();
    },

    // ---------- 上传入队（选择/拖拽 → 目录递归 → 建目录 → 创建任务） ----------
    async createUploadJobs(filePaths, bucketInfo) {
      const api = transferApi();
      if (!api || typeof api.scanFolder !== 'function') return [];
      const auth = useAuthStore().info || {};
      const region = bucketInfo.region;
      const bucket = bucketInfo.bucket;
      const prefix = bucketInfo.key || '';
      const authPayload = buildAuthPayload(auth, region, auth.eptpl);

      this.stopCreating = false;
      const created = [];
      for (const localPath of filePaths) {
        if (this.stopCreating) break;
        let entries = [];
        try {
          entries = unwrap(await api.scanFolder(localPath)) || [];
        } catch (err) {
          continue;
        }
        for (const entry of entries) {
          if (this.stopCreating) break;
          if (entry.isDir) {
            try {
              await ossClient.createFolder(region, bucket, joinKey(prefix, entry.relative));
            } catch (err) {
              // 目录创建失败不阻断文件入队（等价原版 createFolder 失败仅 console）
            }
            continue;
          }
          const options = {
            region,
            from: { name: entry.name, path: entry.path },
            to: { bucket, key: joinKey(prefix, entry.relative) },
            prog: { loaded: 0, total: entry.size || 0 },
          };
          const res = await api.createUpload(authPayload, options);
          const data = unwrap(res);
          if (!data || !data.taskId) continue;
          created.push(this.pushTask(data.taskId, options));
        }
      }
      this.saveProgress();
      return created;
    },

    pushTask(taskId, options) {
      const task = {
        taskId,
        type: 'upload',
        region: options.region,
        from: options.from || {},
        to: options.to || {},
        status: options.status || 'waiting',
        prog: options.prog || { loaded: 0, total: 0 },
        checkPoints: options.checkPoints || null,
        crc64Str: options.crc64Str || '',
        speed: 0,
        message: options.message || '',
        ecCode: options.ecCode || '',
        requestId: options.requestId || '',
        retryTimes: 0,
      };
      this.uploads.push(task);
      this.checkStart();
      return task;
    },

    // ---------- 并发调度（等价 checkStart） ----------
    checkStart() {
      const max = useSettingsStore().maxUploadJobCount || 3;
      this.concurrency = Math.max(0, this.concurrency);
      const api = transferApi();
      if (!api) return;
      for (const task of this.uploads) {
        if (task.status !== 'waiting') continue;
        if (this.concurrency >= max) return;
        api.resume(task.taskId);
        this.concurrency += 1;
      }
    },

    stopCreatingJobs() {
      this.stopCreating = true;
    },

    // ---------- 控制 ----------
    pause(taskId) {
      const api = transferApi();
      if (api) api.pause(taskId);
    },

    resume(taskId) {
      const api = transferApi();
      if (api) api.resume(taskId);
    },

    async remove(taskId) {
      const api = transferApi();
      if (api) await api.clear(taskId);
      const idx = this.uploads.findIndex((t) => t.taskId === taskId);
      if (idx !== -1) {
        const task = this.uploads[idx];
        if (['running', 'waiting', 'verifying', 'retrying'].indexOf(task.status) !== -1) {
          if (api) api.pause(taskId);
        }
        this.uploads.splice(idx, 1);
      }
      this.saveProgress();
    },

    clearCompleted() {
      this.uploads = this.uploads.filter((t) => t.status !== 'finished');
      this.saveProgress();
    },

    clearAll() {
      const api = transferApi();
      for (const task of this.uploads) {
        if (['running', 'waiting', 'verifying', 'retrying'].indexOf(task.status) !== -1 && api) {
          api.pause(task.taskId);
        }
      }
      this.uploads = [];
      this.concurrency = 0;
      this.saveProgress();
    },

    stopAll() {
      this.stopCreatingJobs();
      this.stopCreating = false;
      for (const task of this.uploads) {
        if (['running', 'waiting', 'verifying', 'retrying'].indexOf(task.status) !== -1) {
          this.pause(task.taskId);
        }
      }
      setTimeout(() => this.saveProgress(), 100);
    },

    startAll() {
      for (const task of this.uploads) {
        if (task.status === 'stopped' || task.status === 'failed') {
          task.status = 'waiting';
        }
      }
      this.checkStart();
    },

    async retry(taskId) {
      const api = transferApi();
      if (!api || typeof api.retry !== 'function') return null;
      const res = await api.retry(taskId);
      const data = unwrap(res);
      const task = this.uploads.find((t) => t.taskId === taskId);
      if (data && data.taskId && task) {
        task.taskId = data.taskId;
        task.status = 'waiting';
        task.message = '';
        task.ecCode = '';
        task.requestId = '';
      }
      return data;
    },

    async errorDetail(taskId) {
      const api = transferApi();
      if (!api || typeof api.errorDetail !== 'function') return null;
      const data = unwrap(await api.errorDetail(taskId));
      this.lastErrorDetail = data;
      return data;
    },

    setVisible(visible, tab) {
      this.visible = !!visible;
      if (tab) this.activeTab = tab;
    },

    // ---------- 进度持久化 ----------
    progFileName() {
      const auth = useAuthStore().info || {};
      return newProgFileName(SAVE_PROG_PREFIX, auth.id || '');
    },

    saveProgress() {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        const api = storageApi();
        if (!api || typeof api.writeProgress !== 'function') return;
        const list = this.uploads
          .filter((t) => t.status !== 'finished')
          .map((t) => {
            const checkPoints = t.checkPoints ? Object.assign({}, t.checkPoints) : undefined;
            if (checkPoints) delete checkPoints.chunks;
            return {
              crc64Str: t.crc64Str,
              checkPoints,
              region: t.region,
              to: t.to,
              from: t.from,
              status: t.status,
              message: t.message,
              ecCode: t.ecCode,
              requestId: t.requestId,
              prog: t.prog,
            };
          });
        api.writeProgress(this.progFileName(), JSON.stringify(list)).catch(() => {});
      }, 1000);
    },

    async loadProgress() {
      const api = storageApi();
      const transfer = transferApi();
      if (!api || !transfer) return [];
      const auth = useAuthStore().info || {};
      let content = '';
      try {
        const res = await api.readProgress(this.progFileName());
        const data = unwrap(res);
        if (data && data.exists && data.content) {
          content = data.content;
        } else {
          // legacy 明文命名兼容读（读后回写新名）
          const legacy = await api.readProgress(legacyProgFileName(SAVE_PROG_PREFIX, auth.id || ''));
          const legacyData = unwrap(legacy);
          if (legacyData && legacyData.exists && legacyData.content) {
            content = legacyData.content;
            api.writeProgress(this.progFileName(), content).catch(() => {});
          }
        }
      } catch (err) {
        content = '';
      }
      let list = [];
      try {
        list = JSON.parse(content || '[]');
      } catch (err) {
        list = [];
      }

      const restored = [];
      for (const item of list) {
        if (!item || !item.from || !item.to) continue;
        const options = {
          region: item.region,
          from: item.from,
          to: item.to,
          checkPoints: item.checkPoints,
          crc64Str: item.crc64Str,
          prog: item.prog,
          status: item.status,
          message: item.message,
          ecCode: item.ecCode,
          requestId: item.requestId,
        };
        const res = await transfer.createUpload(buildAuthPayload(auth, item.region, auth.eptpl), options);
        const data = unwrap(res);
        if (!data || !data.taskId) continue;
        const task = this.pushTask(data.taskId, options);
        // 恢复后暂停等待用户（等价 init：waiting/running/verifying/retrying → stop）
        if (['waiting', 'running', 'verifying', 'retrying'].indexOf(task.status) !== -1) {
          task.status = 'stopped';
          transfer.pause(task.taskId);
        }
        restored.push(task);
      }
      return restored;
    },

    reset() {
      this.uploads = [];
      this.downloads = [];
      this.concurrency = 0;
      this.retryTimes = 0;
      this.stopCreating = false;
      this.searchText = '';
      this.lastErrorDetail = null;
    },
  },
});

export default useTransferStore;