<template>
  <div class="bucket-list" data-testid="bucket-list" @click.self="clearSelect" @contextmenu.prevent="emit('spacer-contextmenu', $event)">
    <EmptyState v-if="filesStore.filteredBuckets.length === 0" icon="inbox" :text="t('nodata')" />

    <!-- 列表视图（等价 bucket-list.html table 分支） -->
    <table v-else-if="filesStore.viewMode === 'list'" class="table" data-testid="bucket-table">
      <thead>
        <tr>
          <th class="col-index">-</th>
          <th>{{ t('bucket.name') }}</th>
          <th>{{ t('region') }}</th>
          <th>{{ t('creationTime') }}</th>
          <th class="col-actions">{{ t('actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, index) in filesStore.filteredBuckets"
          :key="item.name"
          :class="{ info: isSelected(item) }"
          @click="filesStore.selectBucket(item)"
          @dblclick="enterBucket(item)"
          @contextmenu.prevent.stop="onContext($event, item)"
        >
          <td class="col-index">{{ index + 1 }}</td>
          <td>
            <span class="bucket-name" :class="{ 'text-warning': item.storageClass !== 'Archive' }">
              <AppIcon name="database" />
              <a href="javascript:void(0)" @click="enterBucket(item)">{{ item.name }}</a>
            </span>
          </td>
          <td>{{ item.region }}</td>
          <td>{{ formatTime(item.creationDate || item.creationTime) }}</td>
          <td class="col-actions">
            <a href="javascript:void(0)" data-testid="bucket-row-delete" @click.stop="removeBucket(item)">
              {{ t('delete') }}
            </a>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 块视图（等价 bucket-list.html card 分支） -->
    <div v-else class="cards" data-testid="bucket-cards" @click.self="clearSelect">
      <div
        v-for="item in filesStore.filteredBuckets"
        :key="item.name"
        class="card"
        :class="{ active: isSelected(item) }"
        @click="filesStore.selectBucket(item)"
        @dblclick="enterBucket(item)"
        @contextmenu.prevent.stop="onContext($event, item)"
      >
        <AppIcon name="inbox" :class="{ 'text-warning': item.storageClass !== 'Archive' }" />
        <div class="card-name" :title="item.name">{{ item.name }}</div>
        <div class="card-region">{{ item.region }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 等价 bucket-list（app/main/files/_/bucket-list.html）：
// 列表/块视图、双击进入（名称链接单击进入）、单选切换、客户端名称过滤、空态 nodata。
// 右键菜单（碎片/ACL/Policy/删除）由 B3-14 自研 ContextMenu 承接；行内删除入口保持等价。
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import EmptyState from '../../base/EmptyState.vue';
import { useFilesStore } from '../../../stores/files.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';
import { formatDateTime } from '../../../services/formatters.js';
import { ossClient } from '../../../services/oss-client.js';

const { t } = useI18n();
const emit = defineEmits(['contextmenu', 'spacer-contextmenu']);
const filesStore = useFilesStore();
const toastStore = useToastStore();
const uiStore = useUiStore();

function onContext(event, item) {
  emit('contextmenu', { event, item });
}

function isSelected(item) {
  return !!filesStore.bucketSelected && filesStore.bucketSelected.name === item.name;
}

function clearSelect() {
  filesStore.bucketSelected = null;
}

function enterBucket(item) {
  filesStore.navigate('oss://' + item.name + '/');
}

function formatTime(value) {
  if (!value) return '';
  return formatDateTime(value);
}

async function removeBucket(item) {
  const confirmed = await uiStore.confirm({
    title: t('bucket.delete.title'),
    message: t('bucket.delete.message', { name: item.name }),
    okText: t('delete'),
    cancelText: t('cancel'),
  });
  if (!confirmed) return;
  try {
    await ossClient.deleteBucket(item.region, item.name);
    toastStore.push(t('bucket.delete.success'), 'success', 2000);
    if (isSelected(item)) {
      filesStore.bucketSelected = null;
    }
    setTimeout(() => filesStore.loadBuckets(), 1000);
  } catch (err) {
    toastStore.push((err && err.message) || 'delete bucket failed', 'danger', 4000);
  }
}
</script>

<style scoped>
.bucket-list {
  min-height: 200px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table th,
.table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--vsc-border-weak);
}
.table tbody tr {
  cursor: default;
}
.table tbody tr:hover {
  background: var(--vsc-bg-hover);
}
.table tbody tr.info {
  background: var(--vsc-bg-active);
}
.col-index {
  width: 40px;
  color: var(--vsc-fg-muted);
}
.col-actions {
  width: 80px;
}
.bucket-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bucket-name a {
  color: var(--vsc-link);
  text-decoration: none;
}
.text-warning {
  color: var(--vsc-warning);
}
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
}
.card {
  width: 160px;
  border: 1px solid var(--vsc-border-weak);
  border-radius: 2px;
  padding: 10px;
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.card:hover {
  background: var(--vsc-bg-hover);
}
.card.active {
  border-color: var(--vsc-link);
  background: var(--vsc-bg-active);
}
.card-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-region {
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
</style>