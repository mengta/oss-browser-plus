<template>
  <BaseModal :visible="true" :title="t('multipart.management')" :mask-closable="false" width="760px" @close="onCancel">
    <div class="multipart-toolbar">
      <label class="check-all">
        <input type="checkbox" :checked="checkedAllCount > 0" data-testid="multipart-check-all" @change="toggleCheckAll" />
      </label>
      <button type="button" class="st-btn st-btn-danger" data-testid="multipart-delete-selected" :disabled="checkedItems.length === 0" @click="deleteSelected">
        {{ t('delete') }} ({{ checkedItems.length }})
      </button>
      <button type="button" class="st-btn st-btn-danger" data-testid="multipart-delete-all" :disabled="items.length === 0" @click="deleteAll">
        {{ t('delete') }} {{ t('all') }}
      </button>
      <span class="spacer" />
      <input v-model="keyword" type="text" class="form-control search" data-testid="multipart-search" :placeholder="t('search')" spellcheck="false" />
      <button type="button" class="st-btn" data-testid="multipart-refresh" @click="refresh">{{ t('refresh') }}</button>
    </div>

    <div class="multipart-body">
      <div v-if="!isLoading && items.length === 0" class="no-data">{{ t('nodata') }}</div>
      <table v-else class="table" data-testid="multipart-table">
        <thead>
          <tr>
            <th class="col-check" />
            <th class="col-index">-</th>
            <th>{{ t('bucket.name') }}</th>
            <th>Upload Id</th>
            <th>{{ t('initiatedTime') }}</th>
            <th class="col-actions">{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in visibleItems" :key="item.uploadId + '|' + item.name">
            <td class="col-check">
              <input type="checkbox" :checked="isChecked(item)" @change="toggleCheck(item)" />
            </td>
            <td class="col-index">{{ index + 1 }}</td>
            <td class="col-name" :title="item.name">{{ item.name }}</td>
            <td class="col-upload" :title="item.uploadId">{{ item.uploadId }}</td>
            <td>{{ formatTime(item.initiated) }}</td>
            <td class="col-actions">
              <a href="javascript:void(0)" data-testid="multipart-row-delete" @click="deleteOne(item)">
                {{ t('delete') }}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="limitTo < filteredItems.length" class="bottom-loader">
        <button type="button" class="st-btn" data-testid="multipart-more" @click="loadNext">{{ t('loadMore') }}</button>
      </div>
    </div>

    <template #footer>
      <button type="button" class="st-btn" data-testid="multipart-close" @click="onCancel">
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 bucket-multipart-modal（app/main/files/modals/bucket-multipart-modal.js）：
// listAllUploads 拉全量 → 本地搜索过滤 + limitTo 20 分期 → 勾选/全选/删除所选/全部/单条
// → ui.confirm(delete.multiparts.*) → abortAllUploads 逐条终止 → 刷新。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';
import { formatDateTime } from '../../../services/formatters.js';

const props = defineProps({
  bucketInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();
const ui = useUiStore();

const items = ref([]);
const isLoading = ref(false);
const keyword = ref('');
const limitTo = ref(20);
const checkedKeys = ref({});

const filteredItems = computed(() => {
  const kw = (keyword.value || '').toLowerCase();
  if (!kw) return items.value;
  return items.value.filter(
    (it) => (it.name || '').toLowerCase().indexOf(kw) !== -1 || (it.uploadId || '').toLowerCase().indexOf(kw) !== -1
  );
});

const visibleItems = computed(() => filteredItems.value.slice(0, limitTo.value));

const checkedItems = computed(() => items.value.filter((it) => checkedKeys.value[it.uploadId + '|' + it.name]));

const checkedAllCount = computed(() => checkedItems.value.length);

function itemKey(it) {
  return it.uploadId + '|' + it.name;
}

function isChecked(it) {
  return !!checkedKeys.value[itemKey(it)];
}

function toggleCheck(it) {
  const key = itemKey(it);
  const next = Object.assign({}, checkedKeys.value);
  if (next[key]) delete next[key];
  else next[key] = true;
  checkedKeys.value = next;
}

function toggleCheckAll() {
  if (checkedItems.value.length > 0) {
    checkedKeys.value = {};
    return;
  }
  const next = {};
  items.value.forEach((it) => {
    next[itemKey(it)] = true;
  });
  checkedKeys.value = next;
}

function loadNext() {
  limitTo.value += 20;
}

function formatTime(value) {
  return value ? formatDateTime(value) : '';
}

function refresh() {
  isLoading.value = true;
  return ossClient
    .listAllUploads(props.bucketInfo.region, props.bucketInfo.name)
    .then((res) => {
      const list = Array.isArray(res) ? res : (res && res.data) || [];
      items.value = list;
      checkedKeys.value = {};
      limitTo.value = 20;
      return items.value;
    })
    .catch(() => [])
    .finally(() => {
      isLoading.value = false;
    });
}

async function showDelete(targets) {
  if (!targets || targets.length === 0) return;
  const confirmed = await ui.confirm({
    title: t('delete.multiparts.title'),
    message: t('delete.multiparts.message'),
    okText: t('delete'),
    cancelText: t('cancel'),
  });
  if (!confirmed) return;
  try {
    await ossClient.abortAllUploads(props.bucketInfo.region, props.bucketInfo.name, targets);
    toast.push(t('delete.multiparts.success'), 'success', 2000);
    await refresh();
  } catch (err) {
    toast.push((err && err.message) || 'abort multipart failed', 'danger', 4000);
  }
}

function deleteSelected() {
  showDelete(checkedItems.value);
}

function deleteAll() {
  showDelete(items.value);
}

function deleteOne(item) {
  showDelete([item]);
}

function onCancel() {
  emit('close');
}

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.multipart-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
}
.check-all {
  display: inline-flex;
  align-items: center;
}
.spacer {
  flex: 1;
}
.form-control.search {
  width: 160px;
}
.multipart-body {
  margin-top: 8px;
  max-height: 360px;
  overflow: auto;
}
.no-data {
  padding: 24px;
  text-align: center;
  color: var(--vsc-fg-muted);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table th,
.table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
}
.col-check {
  width: 30px;
}
.col-index {
  width: 40px;
  color: var(--vsc-fg-muted);
}
.col-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.col-upload {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vsc-fg-muted);
}
.col-actions {
  width: 70px;
}
.bottom-loader {
  text-align: center;
  padding: 8px;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-danger {
  background: var(#a1260d);
  border-color: #a1260d;
  color: var(--vsc-on-accent);
}
</style>