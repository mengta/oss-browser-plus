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
const SAVE_DOWN_PREFIX = 'downprog_';

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
    downloadConcurrency: 0,
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
      this.downloadConcurrency = 0;
      this.retryTimes = 0;
      const loads = [];
      if (this.uploads.length === 0) loads.push(this.loadProgress().then(() => this.checkStart()));
      if (this.downloads.length === 0) loads.push(this.loadDownloadProgress().then(() => this.checkStartDownloads()));
      if (loads.length === 0) return Promise.resolve(this.uploads);
      return Promise.all(loads).then(() => this.uploads);
    },

    // ---------- 广播驱动（上传/下载共用 taskId 分发） ----------
    findTask(taskId) {
      return this.uploads.find((t) => t.taskId === taskId) || this.downloads.find((t) => t.taskId === taskId) || null;
    },

    onPayload(payload) {
      if (!payload || !payload.taskId) return;
      const task = this.findTask(payload.taskId);
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
        if (task.type === 'download') {
          this.downloadConcurrency = Math.max(0, this.downloadConcurrency - 1);
          setTimeout(() => this.checkStartDownloads(), 100);
        } else {
          this.concurrency = Math.max(0, this.concurrency - 1);
          setTimeout(() => this.checkStart(), 100);
        }
      }
      if (task.status === 'finished') {
        task.prog = { loaded: task.prog.total, total: task.prog.total };
      }
      if (task.type === 'download') {
        this.saveDownloadProgress();
      } else {
        this.saveProgress();
      }
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

    // B3-07：下载入队（单对象/批量/目录递归 → 本地目录创建 → 建下载任务）
    // 等价 oss-download-manager：基准目录 = dirname(首项 path)；local = toLocalPath + relative(base, item.path)；
    // 目录项递归 oss.listFiles 分页；本地目录经 transfer.ensureDirs（P0 后渲染层无 fs）。
    async createDownloadJobs(items, toLocalPath, bucketInfo) {
      const transfer = transferApi();
      if (!transfer || typeof transfer.ensureDirs !== 'function') return [];
      if (!Array.isArray(items) || items.length === 0 || !toLocalPath) return [];
      const auth = useAuthStore().info || {};
      const region = bucketInfo.region;
      const bucket = bucketInfo.bucket;
      const authPayload = buildAuthPayload(auth, region, auth.eptpl);
      let isWin = false;
      try {
        const boot = transferApi() && window.ossBrowser.bootstrap ? window.ossBrowser.bootstrap.get() : null;
        isWin = !!(boot && boot.ok && boot.data && boot.data.platform === 'win32');
      } catch (err) {
        isWin = false;
      }
      const sep = isWin ? '\\' : '/';
      const dirOf = (p) => String(p || '').replace(/\/+$/, '').split('/').slice(0, -1)
.join('/');
      const base = dirOf(items[0] && items[0].path);
      const relOf = (p) => {
        const k = String(p || '').replace(/\/+$/, '');
        if (!base) return k;
        if (k === base) return '';
        return k.indexOf(base + '/') === 0 ? k.slice(base.length + 1) : k;
      };
      const toLocal = (rel) => {
        const safe = rel.split('/').filter(Boolean).join(sep);
        return String(toLocalPath).replace(/[\\/]+$/, '') + sep + safe;
      };

      const created = [];
      this.stopCreating = false;

      const enqueueFile = async (it, localPath) => {
        const name = localPath.split(sep).pop() || it.name;
        const options = {
          region,
          from: { bucket, key: it.path },
          to: { name, path: localPath },
          prog: { loaded: 0, total: it.size || 0 },
        };
        const res = await transfer.createDownload(authPayload, options);
        const data = unwrap(res);
        if (data && data.taskId) created.push(this.pushTask(data.taskId, options, 'download'));
      };

      const walk = async (ossPrefix, depth) => {
        if (depth > 64) return;
        let marker = '';
        for (;;) {
          if (this.stopCreating) break;
          let result;
          try {
            // ossClient proxy 已解包为 data（{data, marker}），此处不可再 unwrap
            result = await ossClient.listFiles(region, bucket, ossPrefix, marker);
          } catch (err) {
            break;
          }
          const list = (result && result.data) || [];
          for (const it of list) {
            if (this.stopCreating) break;
            if (it.isFolder) {
              const localRel = relOf(it.path);
              if (localRel) {
                try {
                  await transfer.ensureDirs([toLocal(localRel)]);
                } catch (err) {
                  /* 目录创建失败由任务自身暴露 */
                }
              }
              await walk(it.path, depth + 1);
            } else {
              await enqueueFile(it, toLocal(relOf(it.path)));
            }
          }
          marker = (result && result.marker) || '';
          if (!marker) break;
        }
      };

      for (const it of items) {
        if (this.stopCreating) break;
        if (it.isFolder) {
          const localRel = relOf(it.path);
          if (localRel) {
            try {
              await transfer.ensureDirs([toLocal(localRel)]);
            } catch (err) {
              /* 同上 */
            }
          }
          await walk(it.path, 0);
        } else {
          await enqueueFile(it, toLocal(relOf(it.path)));
        }
      }
      this.saveDownloadProgress();
      return created;
    },

    pushTask(taskId, options, type) {
      const kind = type || 'upload';
      const task = {
        taskId,
        type: kind,
        region: options.region,
        from: options.from || {},
        to: options.to || {},
        status: options.status || 'waiting',
        prog: options.prog || { loaded: 0, total: 0 },
        checkPoints: options.checkPoints || null,
        crc64Str: options.crc64Str || '',
        hashCrc64ecma: options.hashCrc64ecma || '',
        speed: 0,
        message: options.message || '',
        ecCode: options.ecCode || '',
        requestId: options.requestId || '',
        retryTimes: 0,
      };
      if (kind === 'download') {
        this.downloads.push(task);
        this.checkStartDownloads();
      } else {
        this.uploads.push(task);
        this.checkStart();
      }
      return task;
    },

    // ---------- 并发调度（等价 checkStart；下载用 maxDownloadJobCount） ----------
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

    checkStartDownloads() {
      const max = useSettingsStore().maxDownloadJobCount || 1;
      this.downloadConcurrency = Math.max(0, this.downloadConcurrency);
      const api = transferApi();
      if (!api) return;
      for (const task of this.downloads) {
        if (task.status !== 'waiting') continue;
        if (this.downloadConcurrency >= max) return;
        api.resume(task.taskId);
        this.downloadConcurrency += 1;
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
      const lists = [this.uploads, this.downloads];
      for (const list of lists) {
        const idx = list.findIndex((t) => t.taskId === taskId);
        if (idx === -1) continue;
        const task = list[idx];
        if (['running', 'waiting', 'verifying', 'retrying'].indexOf(task.status) !== -1) {
          if (api) api.pause(taskId);
        }
        list.splice(idx, 1);
      }
      this.saveProgress();
      this.saveDownloadProgress();
    },

    clearCompleted(type) {
      const kind = type || 'upload';
      if (kind === 'download') {
        this.downloads = this.downloads.filter((t) => t.status !== 'finished');
        this.saveDownloadProgress();
      } else {
        this.uploads = this.uploads.filter((t) => t.status !== 'finished');
        this.saveProgress();
      }
    },

    clearAll(type) {
      const kind = type || 'upload';
      const api = transferApi();
      const list = kind === 'download' ? this.downloads : this.uploads;
      for (const task of list) {
        if (['running', 'waiting', 'verifying', 'retrying'].indexOf(task.status) !== -1 && api) {
          api.pause(task.taskId);
        }
      }
      if (kind === 'download') {
        this.downloads = [];
        this.downloadConcurrency = 0;
        this.saveDownloadProgress();
      } else {
        this.uploads = [];
        this.concurrency = 0;
        this.saveProgress();
      }
    },

    stopAll(type) {
      const kind = type || 'upload';
      if (kind !== 'download') {
        this.stopCreatingJobs();
        this.stopCreating = false;
      }
      const list = kind === 'download' ? this.downloads : this.uploads;
      for (const task of list) {
        if (['running', 'waiting', 'verifying', 'retrying'].indexOf(task.status) !== -1) {
          this.pause(task.taskId);
        }
      }
      setTimeout(() => {
        if (kind === 'download') {
          this.saveDownloadProgress();
        } else {
          this.saveProgress();
        }
      }, 100);
    },

    startAll(type) {
      const kind = type || 'upload';
      const list = kind === 'download' ? this.downloads : this.uploads;
      for (const task of list) {
        if (task.status === 'stopped' || task.status === 'failed') {
          task.status = 'waiting';
        }
      }
      if (kind === 'download') {
        this.checkStartDownloads();
      } else {
        this.checkStart();
      }
    },

    async retry(taskId) {
      const api = transferApi();
      if (!api || typeof api.retry !== 'function') return null;
      const res = await api.retry(taskId);
      const data = unwrap(res);
      const task = this.findTask(taskId);
      if (data && data.taskId && task) {
        task.taskId = data.taskId;
        task.status = 'waiting';
        task.message = '';
        task.ecCode = '';
        task.requestId = '';
      }
      return data;
    },

    // 等价 downloads.js openLocaleFolder：showItemInFolder（去掉 .download 后缀）
    async openFolder(taskId) {
      const task = this.findTask(taskId);
      const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
      if (!task || !system || typeof system.showItemInFolder !== 'function') return false;
      const target = String((task.to && task.to.path) || '').replace(/\.download$/, '');
      try {
        await system.showItemInFolder(target);
        return true;
      } catch (err) {
        return false;
      }
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

    // B3-07：下载进度持久化（downprog_ 脱敏命名；字段白名单同 upload）
    downProgFileName() {
      const auth = useAuthStore().info || {};
      return newProgFileName(SAVE_DOWN_PREFIX, auth.id || '');
    },

    saveDownloadProgress() {
      if (this._saveDownTimer) clearTimeout(this._saveDownTimer);
      this._saveDownTimer = setTimeout(() => {
        const api = storageApi();
        if (!api || typeof api.writeProgress !== 'function') return;
        const list = this.downloads
          .filter((t) => t.status !== 'finished')
          .map((t) => {
            const checkPoints = t.checkPoints ? Object.assign({}, t.checkPoints) : undefined;
            if (checkPoints) delete checkPoints.chunks;
            return {
              crc64Str: t.crc64Str,
              hashCrc64ecma: t.hashCrc64ecma,
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
        api.writeProgress(this.downProgFileName(), JSON.stringify(list)).catch(() => {});
      }, 1000);
    },

    async loadDownloadProgress() {
      const api = storageApi();
      const transfer = transferApi();
      if (!api || !transfer) return [];
      const auth = useAuthStore().info || {};
      let content = '';
      try {
        const res = await api.readProgress(this.downProgFileName());
        const data = unwrap(res);
        if (data && data.exists && data.content) {
          content = data.content;
        } else {
          const legacy = await api.readProgress(legacyProgFileName(SAVE_DOWN_PREFIX, auth.id || ''));
          const legacyData = unwrap(legacy);
          if (legacyData && legacyData.exists && legacyData.content) {
            content = legacyData.content;
            api.writeProgress(this.downProgFileName(), content).catch(() => {});
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
          hashCrc64ecma: item.hashCrc64ecma,
          prog: item.prog,
          status: item.status,
          message: item.message,
          ecCode: item.ecCode,
          requestId: item.requestId,
        };
        const res = await transfer.createDownload(buildAuthPayload(auth, item.region, auth.eptpl), options);
        const data = unwrap(res);
        if (!data || !data.taskId) continue;
        const task = this.pushTask(data.taskId, options, 'download');
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
      this.downloadConcurrency = 0;
      this.retryTimes = 0;
      this.stopCreating = false;
      this.searchText = '';
      this.lastErrorDetail = null;
    },
  },
});

export default useTransferStore;