<template>
  <div class="downloads-panel" data-testid="downloads-panel">
    <div class="panel-toolbar">
      <input
        v-model="transferStore.searchText"
        type="text"
        class="form-control search"
        data-testid="downloads-search"
        :placeholder="t('transframe.search.placeholder')"
        spellcheck="false"
      />
      <button type="button" class="st-btn" data-testid="downloads-filter-failed" @click="transferStore.searchText = 'failed'">
        {{ t('status.failed') }} ({{ failedCount }})
      </button>
      <button type="button" class="st-btn" data-testid="downloads-filter-stopped" @click="transferStore.searchText = 'stopped'">
        {{ t('status.stopped') }} ({{ stoppedCount }})
      </button>
      <span class="spacer" />
      <button type="button" class="st-btn" data-testid="downloads-start-all" @click="transferStore.startAll('download')">
        {{ t('start.all') }}
      </button>
      <button type="button" class="st-btn" data-testid="downloads-pause-all" @click="transferStore.stopAll('download')">
        {{ t('pause.all') }}
      </button>
      <button type="button" class="st-btn" data-testid="downloads-clear-finished" @click="transferStore.clearCompleted('download')">
        {{ t('clear.finished') }}
      </button>
      <button type="button" class="st-btn st-btn-danger" data-testid="downloads-clear-all" @click="onClearAll">
        {{ t('clear.all') }}
      </button>
    </div>

    <LongScrollList :trigger-size="100" @load-more="loadMore">
      <div v-if="filtered.length === 0" class="no-data">{{ t('nodata') }}</div>
      <div v-else class="task-list">
        <div v-for="(item, index) in visibleItems" :key="item.taskId" class="task-row" data-testid="download-row">
          <div class="col-name">
            <span class="idx">{{ index + 1 }}.</span>
            <span class="name" :title="rowTip(item)">{{ (item.to && item.to.name) || (item.from && item.from.key) }}</span>
            <div class="progress">
              <div class="progress-bar" :style="{ width: percentOf(item) + '%' }" :class="barClass(item)" />
            </div>
          </div>
          <div class="col-status">
            <template v-if="item.status === 'running'">
              {{ sizeFormat(item.speed || 0) }}/s
            </template>
            <template v-else-if="item.status === 'retrying'">
              {{ t('status.retrying') }} ({{ item.retryTimes }})
            </template>
            <template v-else>
              <span :class="{ 'text-danger': item.status === 'failed' }">{{ t('status.' + item.status) || item.status }}</span>
              <a
                v-if="item.status === 'failed' && item.message"
                href="javascript:void(0)"
                class="msg"
                data-testid="download-row-message"
                :title="item.message"
              >
                i
              </a>
            </template>
          </div>
          <div class="col-size">
            {{ sizeFormat(item.prog && item.prog.loaded) }} / {{ sizeFormat(item.prog && item.prog.total) }}
            <span class="pct">{{ percentOf(item) }}%</span>
          </div>
          <div class="col-actions">
            <button
              v-if="canPause(item)"
              type="button"
              class="st-btn st-btn-mini"
              data-testid="download-row-pause"
              :title="t('pause.all')"
              @click="transferStore.pause(item.taskId)"
            >
              ‖
            </button>
            <button
              v-if="item.status === 'stopped' || item.status === 'failed'"
              type="button"
              class="st-btn st-btn-mini st-btn-primary"
              data-testid="download-row-start"
              :title="t('start.all')"
              @click="startItem(item)"
            >
              ▶
            </button>
            <button
              v-if="canRemove(item)"
              type="button"
              class="st-btn st-btn-mini"
              data-testid="download-row-remove"
              :title="t('delete')"
              @click="removeItem(item)"
            >
              ×
            </button>
            <button
              type="button"
              class="st-btn st-btn-mini"
              data-testid="download-row-open-folder"
              :title="t('folder.in')"
              @click="transferStore.openFolder(item.taskId)"
            >
              📂
            </button>
          </div>
        </div>
      </div>
      <div v-if="limitTo < filtered.length" class="bottom-tip">{{ t('loading.more') }}</div>
    </LongScrollList>
  </div>
</template>

<script setup>
// 等价 downloads 面板（app/main/files/transfer/downloads.html + downloads.js）：
// 行：to.name + 进度条 / 速度或状态 / loaded-total+百分比 / 暂停·继续·移除·打开所在文件夹。
// 头部：搜索 + 失败与暂停筛选 + 启动全部/暂停全部/清空已完成/清空所有（confirm，先 stop 运行中）。
// 差异：错误仅 message tooltip（原版下载无 ecCode/requestId 复制）；移除走 store.remove（无 destroy 缺陷）。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LongScrollList from '../base/LongScrollList.vue';
import { useTransferStore } from '../../../stores/transfer.js';
import { useUiStore } from '../../../stores/ui.js';
import { sizeFormat } from '../../../services/file-size.js';

const { t } = useI18n();
const transferStore = useTransferStore();
const ui = useUiStore();

const limitTo = ref(100);

function loadMore() {
  limitTo.value += 100;
}

const filtered = computed(() => {
  const kw = (transferStore.searchText || '').toLowerCase();
  if (!kw) return transferStore.downloads;
  return transferStore.downloads.filter((it) => {
    if (kw === 'failed' || kw === 'stopped') {
      return it.status === kw;
    }
    const name = (it.to && it.to.name) || '';
    return name.toLowerCase().indexOf(kw) !== -1 || it.status.indexOf(kw) !== -1;
  });
});

const visibleItems = computed(() => filtered.value.slice(0, limitTo.value));
const failedCount = computed(() => transferStore.downloads.filter((it) => it.status === 'failed').length);
const stoppedCount = computed(() => transferStore.downloads.filter((it) => it.status === 'stopped').length);

function percentOf(item) {
  const total = (item.prog && item.prog.total) || 0;
  const loaded = (item.prog && item.prog.loaded) || 0;
  if (!total) return item.status === 'finished' ? 100 : 0;
  return Math.min(100, Math.round((loaded * 100) / total));
}

function barClass(item) {
  if (item.status === 'failed') return 'bar-danger';
  if (item.status === 'finished') return 'bar-success';
  return 'bar-primary';
}

function rowTip(item) {
  const from = item.from || {};
  return 'oss://' + (from.bucket || '') + '/' + (from.key || '') + '\n' + ((item.to && item.to.path) || '');
}

function canPause(item) {
  return ['running', 'retrying', 'waiting', 'verifying'].indexOf(item.status) !== -1;
}

function canRemove(item) {
  return ['stopped', 'failed', 'finished'].indexOf(item.status) !== -1;
}

function startItem(item) {
  item.status = 'waiting';
  transferStore.checkStartDownloads();
}

async function removeItem(item) {
  if (item.status === 'finished') {
    await transferStore.remove(item.taskId);
    return;
  }
  const confirmed = await ui.confirm({
    title: t('remove.from.list.title'),
    message: t('remove.from.list.message'),
    okText: t('delete'),
    cancelText: t('cancel'),
  });
  if (confirmed) {
    await transferStore.remove(item.taskId);
  }
}

async function onClearAll() {
  const confirmed = await ui.confirm({
    title: t('clear.all.title'),
    message: t('clear.all.download.message'),
    okText: t('delete'),
    cancelText: t('cancel'),
  });
  if (confirmed) {
    transferStore.clearAll('download');
  }
}
</script>

<style scoped>
.downloads-panel {
  display: flex;
  flex-direction: column;
  max-height: 320px;
}
.panel-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
}
.form-control.search {
  width: 160px;
}
.spacer {
  flex: 1;
}
.no-data {
  padding: 16px;
  text-align: center;
  color: var(--vsc-fg-muted);
}
.task-list {
  padding: 2px 0;
}
.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--vsc-border-weak);
}
.col-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.col-name .idx {
  color: var(--vsc-fg-muted);
}
.col-name .name {
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress {
  flex: 1;
  height: 4px;
  background: var(--vsc-border-weak);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
}
.bar-primary {
  background: var(--vsc-link);
}
.bar-success {
  background: var(--vsc-success-solid);
}
.bar-danger {
  background: var(--vsc-danger-solid);
}
.col-status {
  width: 110px;
  color: var(--vsc-fg-muted);
}
.col-size {
  width: 170px;
  color: var(--vsc-fg-muted);
}
.col-size .pct {
  margin-left: 6px;
  color: var(--vsc-fg-muted);
}
.col-actions {
  width: 110px;
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}
.st-btn {
  padding: 3px 8px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-danger {
  background: var(--vsc-danger-solid);
  border-color: var(--vsc-danger);
  color: var(--vsc-on-accent);
}
.st-btn-mini {
  padding: 0 5px;
  line-height: 18px;
}
.st-btn-primary {
  background: var(--vsc-link);
  border-color: var(--vsc-link);
  color: var(--vsc-on-accent);
}
.text-danger {
  color: var(--vsc-danger);
}
.msg {
  margin-left: 4px;
  color: var(--vsc-link);
  font-style: normal;
  cursor: pointer;
}
.bottom-tip {
  text-align: center;
  padding: 4px;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
</style>