<template>
  <div class="file-list" data-testid="file-list" @contextmenu.prevent="emit('spacer-contextmenu', $event)">
    <EmptyState v-if="!filesStore.isLoading && filesStore.items.length === 0" icon="inbox" :text="t('nodata')" />

    <template v-else>
      <!-- 列表视图（等价 file-list.html:9-164） -->
      <table v-if="filesStore.viewMode === 'list'" class="table" data-testid="file-table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                type="checkbox"
                :checked="filesStore.selectedAll"
                data-testid="file-check-all"
                @change="filesStore.selectAll()"
              />
            </th>
            <th>{{ t('name') }}</th>
            <th class="col-size">{{ t('type') }} / {{ t('size') }}</th>
            <th class="col-time">{{ t('lastModifyTime') }}</th>
            <th class="col-actions">{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in filesStore.items"
            :key="item.path"
            :class="{ info: isSelected(index) }"
            data-testid="file-row"
            @click="filesStore.selectChanged(index, $event.shiftKey)"
            @contextmenu.prevent.stop="onContext($event, item, index)"
          >
            <td class="col-check">
              <input type="checkbox" :checked="isSelected(index)" @change="filesStore.selectChanged(index, false)" />
            </td>
            <td class="col-name">
              <span class="name-cell">
                <AppIcon
                  :name="iconOf(item).name"
                  :class="iconOf(item).cls"
                  :title="iconOf(item).tip"
                />
                <template v-if="item.isFolder">
                  <a href="javascript:void(0)" data-testid="file-folder-link" @click.stop="enterFolder(item)">
                    {{ shortName(item.name) }}
                  </a>
                </template>
                <template v-else>
                  <a
                    href="javascript:void(0)"
                    data-testid="file-open-link"
                    :class="{ muted: isUploading(item) }"
                    @click.stop="openItem(item)"
                  >
                    {{ shortName(item.name) }}
                  </a>
                </template>
              </span>
            </td>
            <td class="col-size">
              <span v-if="item.isFolder">{{ t('folder') }}</span>
              <span v-else>{{ sizeFormat(item.size) }}</span>
            </td>
            <td class="col-time">{{ item.isFolder ? '' : formatTime(item.lastModified) }}</td>
            <td class="col-actions">
              <a
                v-if="canGetAddress(item)"
                href="javascript:void(0)"
                data-testid="file-row-address"
                @click.stop="emitAction('address', item)"
              >
                {{ t('getAddress') }}
              </a>
              <a
                v-if="canDownload(item)"
                href="javascript:void(0)"
                data-testid="file-row-download"
                @click.stop="emitAction('download', item)"
              >
                {{ t('download') }}
              </a>
              <a
                v-if="canRestore(item)"
                href="javascript:void(0)"
                data-testid="file-row-restore"
                @click.stop="emitAction('restore', item)"
              >
                {{ t('restore') }}
              </a>
              <a href="javascript:void(0)" data-testid="file-row-delete" @click.stop="emitAction('delete', item)">
                {{ t('delete') }}
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 块视图（等价 file-list.html:166-233） -->
      <div v-else class="cards" data-testid="file-cards" @click.self="filesStore.clearSelection()">
        <div
          v-for="(item, index) in filesStore.items"
          :key="item.path"
          class="card"
          :class="{ active: isSelected(index) }"
          data-testid="file-card"
          @click="filesStore.selectChanged(index, $event.shiftKey)"
          @contextmenu.prevent.stop="onContext($event, item, index)"
          @dblclick="item.isFolder ? enterFolder(item) : openItem(item)"
        >
          <input
            type="checkbox"
            class="card-check"
            :checked="isSelected(index)"
            @change="filesStore.selectChanged(index, false)"
          />
          <img v-if="item.pic_url" :src="item.pic_url" class="card-thumb" alt="" />
          <AppIcon v-else :name="iconOf(item).name" :class="iconOf(item).cls" :title="iconOf(item).tip" />
          <div class="card-name" :title="item.name">{{ item.name }}</div>
          <div class="card-desc">{{ item.isFolder ? t('folder') : sizeFormat(item.size) }}</div>
        </div>
      </div>

      <!-- 分页触底（等价 files.html:35-40 bottom-loader + loading.more） -->
      <BottomLoader :disabled="!filesStore.hasMore || filesStore.isLoading" :text="t('loading.more')" @load-more="filesStore.loadMore()" />
    </template>
  </div>
</template>

<script setup>
// 等价 file-list（app/main/files/_/file-list.html）：
// 列表/块视图、目录置顶（DTO 顺序）、单击选中（shift 区间）、名称链接进入/打开、
// Archive 状态图标（hourglass/square 语义）、symlink 展示、操作列条件与滚动触底分页。
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import EmptyState from '../../base/EmptyState.vue';
import BottomLoader from '../base/BottomLoader.vue';
import { useFilesStore } from '../../../stores/files.js';
import { getFileType } from '../../../services/file-type.js';
import { sizeFormat } from '../../../services/file-size.js';
import { formatDateTime } from '../../../services/formatters.js';

const { t } = useI18n();
const filesStore = useFilesStore();
const emit = defineEmits(['preview', 'action', 'contextmenu', 'spacer-contextmenu']);

function onContext(event, item, index) {
  emit('contextmenu', { event, item, index });
}

function isSelected(index) {
  return !!filesStore.selectedMap['i_' + index];
}

function shortName(name) {
  const s = String(name || '');
  return s.length > 50 ? s.slice(0, 50) : s;
}

function isUploading(item) {
  return item && item.status === 'uploading';
}

// 等价 fileIcon filter（app/components/filters/formater.js:171-186）：
// storageStatus==2 → hourglass 警示；Archive 未解冻 → 灰；Symlink → 链接图标。
function iconOf(item) {
  if (!item) return { name: 'file', cls: '', tip: '' };
  if (item.storageStatus === 2) return { name: 'hourglass', cls: 'text-warning', tip: t('restore') };
  if (item.storageClass === 'Archive' && item.storageStatus !== 3) {
    return { name: 'file', cls: 'text-muted', tip: '' };
  }
  if (item.isFolder) return { name: 'folder', cls: 'text-folder', tip: '' };
  if (item.type === 'Symlink') return { name: 'soft-link', cls: 'text-link', tip: item.name };
  getFileType(item);
  return { name: 'file', cls: '', tip: '' };
}

function canGetAddress(item) {
  return !item.isFolder && (item.storageClass !== 'Archive' || item.storageStatus === 3);
}

// 原版语义保持：目录也显示下载入口（file-list.html:133-139 未判 isFolder）
function canDownload(item) {
  return item.storageClass !== 'Archive' || item.storageStatus === 3;
}

function canRestore(item) {
  return !item.isFolder && item.storageClass === 'Archive' && item.storageStatus !== 3;
}

function formatTime(value) {
  return value ? formatDateTime(value) : '';
}

function enterFolder(item) {
  filesStore.enterFolder(item);
}

function openItem(item) {
  emit('preview', item);
}

function emitAction(type, item) {
  emit('action', { type, item });
}
</script>

<style scoped>
.file-list {
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
.col-check {
  width: 30px;
}
.col-size {
  width: 140px;
  color: var(--vsc-fg-muted);
}
.col-time {
  width: 170px;
  color: var(--vsc-fg-muted);
}
.col-actions {
  width: 220px;
  text-align: right;
  white-space: nowrap;
}
.col-actions a {
  margin-left: 8px;
  color: var(--vsc-link);
  text-decoration: none;
}
.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.name-cell a {
  color: var(--vsc-fg);
  text-decoration: none;
}
.name-cell a:hover {
  color: var(--vsc-link);
}
.name-cell a.muted {
  color: var(--vsc-fg-muted);
}
.text-warning {
  color: var(--vsc-warning);
}
.text-muted {
  color: var(--vsc-fg-muted);
}
.text-folder {
  color: #dcb67a;
}
.text-link {
  color: var(--vsc-link);
}
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
}
.card {
  position: relative;
  width: 200px;
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
.card-check {
  position: absolute;
  top: 6px;
  right: 6px;
}
.card-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 2px;
}
.card-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-desc {
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
</style>