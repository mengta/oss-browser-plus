<template>
  <div ref="listRoot" class="file-list" data-testid="file-list" @contextmenu.prevent="emit('spacer-contextmenu', $event)">
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
                @click.stop
                @change="filesStore.selectAll()"
              />
            </th>
            <th>{{ t('name') }}</th>
            <th class="col-storage">{{ t('storageClass') }}</th>
            <th class="col-size">{{ t('type') }} / {{ t('size') }}</th>
            <th class="col-time">{{ t('lastModifyTime') }}</th>
            <th class="col-actions">{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="topPad > 0" class="row-spacer" aria-hidden="true">
            <td colspan="6" :style="{ height: topPad + 'px' }"></td>
          </tr>
          <tr
            v-for="row in renderRows"
            :key="row.item.path"
            :class="{ info: isSelected(row.index) }"
            data-testid="file-row"
            @click="filesStore.selectChanged(row.index, $event.shiftKey)"
            @contextmenu.prevent.stop="onContext($event, row.item, row.index)"
          >
            <td class="col-check">
              <input type="checkbox" :checked="isSelected(row.index)" @click.stop @change="filesStore.selectChanged(row.index, false)" />
            </td>
            <td class="col-name">
              <span class="name-cell">
                <AppIcon
                  :name="row.icon.name"
                  :class="row.icon.cls"
                  :title="row.icon.tip"
                />
                <template v-if="row.item.isFolder">
                  <a href="javascript:void(0)" data-testid="file-folder-link" @click.stop="enterFolder(row.item)">
                    {{ row.shortName }}
                  </a>
                </template>
                <template v-else>
                  <a
                    href="javascript:void(0)"
                    data-testid="file-open-link"
                    :class="{ muted: isUploading(row.item) }"
                    @click.stop="openItem(row.item)"
                  >
                    {{ row.shortName }}
                  </a>
                </template>
              </span>
            </td>
            <td class="col-storage">
              <span class="storage-tag">{{ row.storageText }}</span>
            </td>
            <td class="col-size">
              <span v-if="row.item.isFolder">{{ t('folder') }}</span>
              <span v-else>{{ row.sizeText }}</span>
            </td>
            <td class="col-time">{{ row.timeText }}</td>
            <td class="col-actions">
              <a
                v-if="row.canAddress"
                href="javascript:void(0)"
                data-testid="file-row-address"
                @click.stop="emitAction('address', row.item)"
              >
                {{ t('getAddress') }}
              </a>
              <a
                v-if="row.canDownload"
                href="javascript:void(0)"
                data-testid="file-row-download"
                @click.stop="emitAction('download', row.item)"
              >
                {{ t('download') }}
              </a>
              <a
                v-if="row.canRestore"
                href="javascript:void(0)"
                data-testid="file-row-restore"
                @click.stop="emitAction('restore', row.item)"
              >
                {{ t('restore') }}
              </a>
              <a href="javascript:void(0)" data-testid="file-row-delete" @click.stop="emitAction('delete', row.item)">
                {{ t('delete') }}
              </a>
            </td>
          </tr>
          <tr v-if="bottomPad > 0" class="row-spacer" aria-hidden="true">
            <td colspan="6" :style="{ height: bottomPad + 'px' }"></td>
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
            @click.stop
            @change="filesStore.selectChanged(index, false)"
          />
          <CardThumb
            v-if="isImage(item)"
            :region="filesStore.region"
            :bucket="filesStore.bucket"
            :item="item"
          />
          <AppIcon v-else :name="iconOf(item).name" :class="iconOf(item).cls" :title="iconOf(item).tip" />
          <div class="card-name" :title="item.name">{{ item.name }}</div>
          <div class="card-desc">{{ item.isFolder ? t('folder') : sizeFormat(item.size) }}</div>
          <div v-if="!item.isFolder" class="card-meta">
            <span class="card-storage">{{ item.storageClass || 'Standard' }}</span>
            <span>{{ formatTime(item.lastModified) }}</span>
          </div>
        </div>
      </div>

      <!-- 分页触底（等价 files.html:35-40 bottom-loader + loading.more） -->
      <BottomLoader
        :disabled="!filesStore.hasMore || filesStore.isLoading"
        :loading="filesStore.isLoading"
        :text="t('loading.more')"
        @load-more="filesStore.loadMore()"
      />
    </template>
  </div>
</template>

<script setup>
// 等价 file-list（app/main/files/_/file-list.html）：
// 列表/块视图、目录置顶（DTO 顺序）、单击选中（shift 区间）、名称链接进入/打开、
// Archive 状态图标（hourglass/square 语义）、symlink 展示、操作列条件与滚动触底分页。
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import CardThumb from '../../base/CardThumb.vue';
import EmptyState from '../../base/EmptyState.vue';
import BottomLoader from '../base/BottomLoader.vue';
import { useFilesStore } from '../../../stores/files.js';
import { getFileType } from '../../../services/file-type.js';
import { sizeFormat } from '../../../services/file-size.js';
import { formatDateTime } from '../../../services/formatters.js';
import { useVirtualRows } from '../../../composables/useVirtualRows.js';
import { findScrollParent } from '../../../services/scroll-parent.js';

// P5（R-P5-01）：固定行高单点常量（CSS 变量 --file-row-height 与 JS 常量同值）
const ROW_HEIGHT = 32;

const { t } = useI18n();
const filesStore = useFilesStore();
const emit = defineEmits(['preview', 'action', 'contextmenu', 'spacer-contextmenu']);

// P5（R-P5-01/02/04）：列表视图窗口化 + 行数据一次性预计算
const listRoot = ref(null);
const viewportHeight = ref(0);
const virtual = useVirtualRows({
  total: computed(() => filesStore.items.length),
  rowHeight: ROW_HEIGHT,
  viewportHeight,
});
const topPad = virtual.topPad;
const bottomPad = virtual.bottomPad;

const renderRows = computed(() => {
  const items = filesStore.items;
  const rows = [];
  for (let i = virtual.start.value; i < virtual.end.value; i += 1) {
    const item = items[i];
    if (!item) continue;
    rows.push({
      item,
      index: i,
      icon: iconOf(item),
      shortName: shortName(item.name),
      sizeText: item.isFolder ? '' : sizeFormat(item.size),
      storageText: item.isFolder ? '—' : item.storageClass || 'Standard',
      timeText: item.isFolder ? '' : formatTime(item.lastModified),
      canAddress: canGetAddress(item),
      canDownload: canDownload(item),
      canRestore: canRestore(item),
    });
  }
  return rows;
});

let scroller = null;

function syncViewport() {
  if (scroller) viewportHeight.value = scroller.clientHeight;
}

function onListScroll(event) {
  virtual.onScroll(event);
}

function onWindowResize() {
  syncViewport();
}

onMounted(async () => {
  await nextTick();
  scroller = findScrollParent(listRoot.value);
  if (scroller) {
    scroller.addEventListener('scroll', onListScroll, { passive: true });
    syncViewport();
  }
  window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(() => {
  if (scroller) scroller.removeEventListener('scroll', onListScroll);
  window.removeEventListener('resize', onWindowResize);
  virtual.dispose();
});

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

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;

// 块视图缩略图：Content-Type 或扩展名判定图片（OSS image/resize 不支持 svg/ico，故不纳入）
function isImage(item) {
  if (!item || item.isFolder) return false;
  if (String(item.type || '').toLowerCase().indexOf('image/') === 0) return true;
  return IMAGE_EXT.test(String(item.name || ''));
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
  background: var(--vsc-surface-1);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}
.table th,
.table td {
  text-align: left;
  padding: 0 10px;
  height: 32px;
  line-height: 32px;
  border-bottom: 1px solid var(--vsc-border-weak);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.table tbody tr {
  cursor: default;
  height: 32px;
}
.row-spacer td {
  padding: 0;
  border: none;
  line-height: 0;
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
.col-storage {
  width: 112px;
  color: var(--vsc-fg-muted);
}
.storage-tag {
  display: inline-block;
  padding: 0 6px;
  height: 18px;
  line-height: 17px;
  border: 1px solid var(--vsc-border-weak);
  border-radius: 2px;
  font-size: 11px;
  color: var(--vsc-fg-muted);
  background: var(--vsc-bg-elevated);
}
.col-size {
  width: 120px;
  color: var(--vsc-fg-muted);
}
.col-time {
  width: 160px;
  color: var(--vsc-fg-muted);
}
.col-actions {
  width: 210px;
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
  color: var(--vsc-highlight);
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
  background: var(--vsc-surface-2);
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 6px;
  content-visibility: auto;
  contain-intrinsic-size: 200px 150px;
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
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--vsc-fg-dim);
}
.card-storage {
  color: var(--vsc-fg-muted);
}
</style>