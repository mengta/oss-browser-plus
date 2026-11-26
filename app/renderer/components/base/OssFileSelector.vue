<template>
  <div class="oss-file-selector" data-testid="oss-file-selector">
    <div class="path-row">
      <input :value="selected.ossPath" type="text" readonly class="form-control" data-testid="oss-selector-path" />
      <button type="button" class="st-btn" data-testid="oss-selector-up" :disabled="upDisabled" @click="goUp">
        ↑
      </button>
    </div>
    <div class="list-box" :style="{ height: height + 'px' }" data-testid="oss-selector-list">
      <div v-if="isLoading" class="loading">{{ t('loading') }}</div>
      <table v-else class="table">
        <tbody>
          <tr
            v-for="item in items"
            :key="(item.region || '') + item.name + (item.path || '')"
            :class="{ info: item.path === keepConfig.key }"
            data-testid="oss-selector-row"
            @click="goIn(item)"
          >
            <td class="cell">
              <AppIcon :name="item.region ? 'database' : item.isFolder ? 'folder' : 'file'" />
              <span class="name">{{ item.name }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// 等价 oss-file-selector 指令（app/components/directives/oss-file-selector.js + html）：
// 目录树选择：bucket 列表 / 目录内对象分页（listAllFiles folderOnly）→ 点击行 goIn；
// 上行 goUp 逐级回退；selectedItem 输出 { ossPath, region }（oss://bucket/key 格式）。
// 原版未在 move-modal 启用（step==1 被注释），本批作为基座按 R-07 等价保留。
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';
import { ossClient } from '../../services/oss-client.js';

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  selectedItem: { type: Object, default: () => ({}) },
  showBuckets: { type: Boolean, default: true },
  folderOnly: { type: Boolean, default: true },
  height: { type: Number, default: 200 },
});

const emit = defineEmits(['update:selectedItem']);
const { t } = useI18n();

const keepConfig = reactive({ region: '', bucket: '', key: '' });
const selected = reactive({ ossPath: 'oss://', region: '' });
const items = ref([]);
const isLoading = ref(false);

const upDisabled = computed(() => {
  if (!props.showBuckets && keepConfig.bucket !== '' && keepConfig.key === '') return true;
  if (props.showBuckets && keepConfig.bucket === '') return true;
  return false;
});

function syncSelected() {
  const payload = { ossPath: selected.ossPath, region: selected.region };
  Object.assign(props.selectedItem || {}, payload);
  emit('update:selectedItem', payload);
}

function parsePath(value) {
  const text = String(value || '');
  const rest = text.indexOf('oss://') === 0 ? text.slice(6) : text;
  const idx = rest.indexOf('/');
  if (idx === -1) return { bucket: rest, key: '' };
  return { bucket: rest.slice(0, idx), key: rest.slice(idx + 1) };
}

function refresh() {
  if (!keepConfig.bucket) {
    selected.ossPath = 'oss://';
    selected.region = '';
    syncSelected();
    isLoading.value = true;
    ossClient
      .listAllBuckets()
      .then((arr) => {
        items.value = Array.isArray(arr) ? arr : [];
      })
      .finally(() => {
        isLoading.value = false;
      });
    return;
  }

  selected.ossPath = 'oss://' + keepConfig.bucket + '/' + (keepConfig.key || '');
  selected.region = keepConfig.region || '';
  syncSelected();

  if (keepConfig.key && keepConfig.key.lastIndexOf('/') === keepConfig.key.length - 1) {
    isLoading.value = true;
    ossClient
      .listAllFiles(keepConfig.region, keepConfig.bucket, keepConfig.key, props.folderOnly)
      .then((arr) => {
        items.value = Array.isArray(arr) ? arr : [];
      })
      .finally(() => {
        isLoading.value = false;
      });
  }
}

function goIn(item) {
  if (!item) return;
  if (item.region) {
    keepConfig.region = item.region;
    keepConfig.key = '';
    keepConfig.bucket = item.name;
  } else if (item.isFolder) {
    keepConfig.key = String(item.path || '').replace(/\/$/, '') + '/';
  } else {
    keepConfig.key = String(item.path || '').replace(/\/$/, '');
  }
  refresh();
}

function select(item) {
  if (!item) return;
  if (item.region) {
    selected.ossPath = 'oss://' + item.name;
  } else if (item.isFolder) {
    selected.ossPath =
      'oss://' + keepConfig.bucket + '/' + String(item.path || '').replace(/\/$/, '') + '/';
  } else {
    selected.ossPath =
      'oss://' + keepConfig.bucket + '/' + String(item.path || '').replace(/\/$/, '');
  }
  syncSelected();
}

function goUp() {
  const value = selected.ossPath;
  if (value === 'oss://') return;

  const info = parsePath(value);
  if (info.key === '') {
    if (!props.showBuckets) return;
    keepConfig.bucket = '';
    keepConfig.key = '';
    refresh();
    return;
  }

  const key = info.key.replace(/\/$/, '');
  const next = key.substring(0, key.lastIndexOf('/'));
  keepConfig.key = next !== '' ? next + '/' : '';
  refresh();
}

watch(
  () => props.config,
  () => {
    const cfg = props.config || {};
    keepConfig.region = cfg.region || '';
    keepConfig.bucket = cfg.bucket || '';
    keepConfig.key = cfg.key || '';
    refresh();
  },
  { deep: true }
);

onMounted(() => {
  const cfg = props.config || {};
  keepConfig.region = cfg.region || '';
  keepConfig.bucket = cfg.bucket || '';
  keepConfig.key = cfg.key || '';
  refresh();
});

defineExpose({ select, goIn, goUp, refresh });
</script>

<style scoped>
.path-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.form-control {
  flex: 1;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--vsc-bg-elevated);
}
.list-box {
  width: 100%;
  overflow: auto;
  border: 1px solid var(--vsc-border);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin: 0;
}
.table tr {
  cursor: pointer;
}
.table tr.info {
  background: var(--vsc-info-bg);
}
.table tr:hover {
  background: var(--vsc-bg-hover);
}
.cell {
  padding: 4px 8px;
}
.name {
  margin-left: 4px;
}
.loading {
  padding: 16px;
  text-align: center;
  color: var(--vsc-fg-muted);
}
.st-btn {
  padding: 4px 10px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>