// 等价 Angular filesCtrl 数据层（files.js）单一来源（B3-01）：
// bucket 列表 / 对象列表 / 导航 / 搜索 / 视图 / 选中 / 排序。
// 行为锚点：目录置顶（主进程 DTO 顺序）、服务端 prefix 搜索、marker 分页、
// 选中 sel 双轨（map + 派生数组）、视图 'is-list-view' localStorage、shift 区间批量选中。
import { defineStore } from 'pinia';
import { ossClient } from '../services/oss-client.js';
import { useToastStore } from './toast.js';

const VIEW_LS_KEY = 'is-list-view';

function parseOssAddress(addr) {
  if (!addr || String(addr).indexOf('oss://') !== 0) {
    return null;
  }
  const rest = String(addr).slice(6);
  const idx = rest.indexOf('/');
  if (idx === -1) {
    return { bucket: rest, key: '' };
  }
  return { bucket: rest.slice(0, idx), key: rest.slice(idx + 1) };
}

function buildBucketMap(buckets) {
  const map = {};
  for (const b of buckets) {
    if (b && b.name) {
      map[b.name] = b;
    }
  }
  return map;
}

function compareBy(key, dir) {
  const factor = dir === 'desc' ? -1 : 1;
  return function (a, b) {
    const av = a && a[key];
    const bv = b && b[key];
    if (av === bv) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * factor;
    }
    return String(av).localeCompare(String(bv)) * factor;
  };
}

// P5（R-P5-03）：排序态下的线性归并（目录置顶语义保持，O(n+m) 而非整体 sort）
function mergeTwoSorted(a, b, cmp) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    out.push(cmp(a[i], b[j]) <= 0 ? a[i++] : b[j++]);
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

function mergeSortedItems(current, incoming, cmp) {
  const curFolders = current.filter((i) => i.isFolder);
  const curFiles = current.filter((i) => !i.isFolder);
  const newFolders = incoming.filter((i) => i.isFolder).sort(cmp);
  const newFiles = incoming.filter((i) => !i.isFolder).sort(cmp);
  return mergeTwoSorted(curFolders, newFolders, cmp).concat(mergeTwoSorted(curFiles, newFiles, cmp));
}

export const useFilesStore = defineStore('files', {
  state: () => ({
    buckets: [],
    bucketsLoaded: false,
    items: [],
    marker: null,
    isLoading: false,
    region: '',
    bucket: '',
    prefix: '',
    viewMode: (function () {
      try {
        return (
          typeof localStorage !== 'undefined' &&
          localStorage.getItem(VIEW_LS_KEY) !== 'false'
        )
          ? 'list'
          : 'blocks';
      } catch (err) {
        return 'list';
      }
    })(),
    sortKey: null,
    sortDir: 'asc',
    searchKeyword: '',
    bucketFilter: '',
    bucketSelected: null,
    selectedAll: false,
    selectedMap: {},
    selectedList: [],
    lastSelectedIndex: null,
  }),

  getters: {
    isBucketList: (state) => !state.bucket,
    hasMore: (state) => !!state.marker,
    objectCount: (state) => state.items.length,
    filteredBuckets(state) {
      const kw = (state.bucketFilter || '').toLowerCase();
      if (!kw) {
        return state.buckets;
      }
      // 等价 buckets|filter:sch.bucketName（客户端名称过滤）
      return state.buckets.filter((b) => (b.name || '').toLowerCase().indexOf(kw) !== -1);
    },
    address(state) {
      return state.bucket ? 'oss://' + state.bucket + '/' + state.prefix : '';
    },
  },

  actions: {
    // ---------- 视图 ----------
    setView(mode) {
      this.viewMode = mode === 'blocks' ? 'blocks' : 'list';
      try {
        localStorage.setItem(VIEW_LS_KEY, mode === 'blocks' ? 'false' : 'true');
      } catch (err) {
        /* 存储不可用时仅内存态 */
      }
    },

    notifyError(err) {
      const code = (err && err.code) || 'Error';
      const message = (err && err.message) || String(err || '');
      try {
        useToastStore().push(code + ': ' + message, 'danger', 4000);
      } catch (e) {
        console.error(code + ': ' + message, err);
      }
    },

    // ---------- Bucket ----------
    loadBuckets() {
      this.isLoading = true;
      return ossClient
        .listAllBuckets()
        .then((data) => {
          this.buckets = Array.isArray(data) ? data : [];
          this.bucketsLoaded = true;
          return this.buckets;
        })
        .catch((err) => {
          this.buckets = [];
          this.notifyError(err);
          throw err;
        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    regionOf(bucketName) {
      const b = buildBucketMap(this.buckets)[bucketName];
      return (b && b.region) || this.region || '';
    },

    // 等价 selectBucket（files.js:1138-1144）：单选切换式
    selectBucket(bucket) {
      if (this.bucketSelected && this.bucketSelected.name === bucket.name) {
        this.bucketSelected = null;
      } else {
        this.bucketSelected = bucket;
      }
    },

    // ---------- 对象列表 ----------
    loadObjects(reset = true) {
      if (!this.bucket) {
        return Promise.resolve([]);
      }
      this.isLoading = true;
      const marker = reset ? '' : this.marker || '';
      const region = this.region || this.regionOf(this.bucket);
      return ossClient
        .listFiles(region, this.bucket, this.prefix, marker)
        .then((result) => {
          const list = (result && result.data) || [];
          if (reset) {
            this.items = list;
            // P5：reset 时应用排序（用户点击排序亦走 setSort → applySort）
            if (this.sortKey) {
              this.applySort();
            }
          } else if (this.sortKey) {
            // 排序态：新片段排序后线性归并（保持顺序稳定、无重复/丢失）
            const cmp = compareBy(this.sortKey, this.sortDir);
            this.items = mergeSortedItems(this.items, list, cmp);
          } else {
            // 原地追加，避免 concat 导致累计拷贝（O(n²)）
            for (let i = 0; i < list.length; i += 1) this.items.push(list[i]);
          }
          this.marker = (result && result.marker) || null;
          this.lastSelectedIndex = null;
          this.clearSelection();
          return this.items;
        })
        .catch((err) => {
          if (reset) {
            this.items = [];
            this.marker = null;
          }
          this.notifyError(err);
          throw err;
        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    loadMore() {
      if (!this.marker || this.isLoading) {
        return Promise.resolve(this.items);
      }
      return this.loadObjects(false);
    },

    // ---------- 导航 ----------
    async navigate(address) {
      const parsed = parseOssAddress(address);
      if (!parsed || !parsed.bucket) {
        return null;
      }
      this.bucket = parsed.bucket;
      this.prefix = parsed.key || '';
      if (!this.region) {
        if (!this.bucketsLoaded) {
          try {
            await this.loadBuckets();
          } catch (err) {
            // 仅对象权限账号无法列举 bucket：沿用已有 region/端点继续
          }
        }
        this.region = this.regionOf(this.bucket);
      }
      this.searchKeyword = '';
      return this.loadObjects(true);
    },

    enterFolder(item) {
      if (!item || !item.path) {
        return Promise.resolve(null);
      }
      return this.navigate('oss://' + this.bucket + '/' + item.path);
    },

    goUp() {
      if (!this.prefix) {
        return Promise.resolve(null);
      }
      let next = this.prefix.slice(0, this.prefix.length - 1);
      const idx = next.lastIndexOf('/');
      next = idx === -1 ? '' : next.slice(0, idx + 1);
      return this.navigate('oss://' + this.bucket + '/' + next);
    },

    // 服务端 prefix 过滤（等价 searchObjectName：key += keyword 后重新拉取）
    search(keyword) {
      this.searchKeyword = keyword || '';
      this.prefix = this.prefix + this.searchKeyword;
      return this.loadObjects(true);
    },

    // ---------- 排序 ----------
    setSort(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDir = 'asc';
      }
      this.applySort();
    },

    applySort() {
      if (!this.sortKey) {
        return;
      }
      const cmp = compareBy(this.sortKey, this.sortDir);
      const folders = this.items.filter((i) => i.isFolder);
      const files = this.items.filter((i) => !i.isFolder);
      this.items = folders.sort(cmp).concat(files.sort(cmp));
    },

    // ---------- 选中（等价 sel 双轨） ----------
    clearSelection() {
      this.selectedAll = false;
      this.selectedMap = {};
      this.selectedList = [];
    },

    selectAll() {
      this.selectedAll = !this.selectedAll;
      const map = {};
      const list = [];
      if (this.selectedAll) {
        for (let i = 0; i < this.items.length; i++) {
          map['i_' + i] = true;
          list.push(this.items[i]);
        }
      }
      this.selectedMap = map;
      this.selectedList = list;
    },

    selectChanged(index, shiftKey) {
      const flip = (i) => {
        const k = 'i_' + i;
        if (this.selectedMap[k]) {
          delete this.selectedMap[k];
        } else {
          this.selectedMap[k] = true;
        }
      };

      if (shiftKey && this.lastSelectedIndex != null) {
        const from = Math.min(this.lastSelectedIndex, index);
        const to = Math.max(this.lastSelectedIndex, index);
        for (let i = from; i <= to; i++) {
          this.selectedMap['i_' + i] = true;
        }
      } else {
        flip(index);
        this.lastSelectedIndex = index;
      }

      // 重算 all/has（等价 selectChanged 1106-1135）
      const list = [];
      let all = true;
      for (let i = 0; i < this.items.length; i++) {
        if (this.selectedMap['i_' + i]) {
          list.push(this.items[i]);
        } else {
          all = false;
        }
      }
      this.selectedList = list;
      this.selectedAll = this.items.length > 0 && all;
    },

    // ---------- 账号切换清空（B3-02 契约：reset 后无上一账号残留） ----------
    reset() {
      this.buckets = [];
      this.bucketsLoaded = false;
      this.items = [];
      this.marker = null;
      this.isLoading = false;
      this.region = '';
      this.bucket = '';
      this.prefix = '';
      this.sortKey = null;
      this.sortDir = 'asc';
      this.searchKeyword = '';
      this.lastSelectedIndex = null;
      this.clearSelection();
    },
  },
});

export default useFilesStore;