<template>
  <div class="uploads-panel" data-testid="uploads-panel">
    <div class="panel-toolbar">
      <input
        v-model="transferStore.searchText"
        type="text"
        class="form-control search"
        data-testid="uploads-search"
        :placeholder="t('transframe.search.placeholder')"
        spellcheck="false"
      />
      <button type="button" class="st-btn" data-testid="uploads-filter-failed" @click="transferStore.searchText = 'failed'">
        {{ t('status.failed') }} ({{ transferStore.uploadFailed }})
      </button>
      <button type="button" class="st-btn" data-testid="uploads-filter-stopped" @click="transferStore.searchText = 'stopped'">
        {{ t('status.stopped') }} ({{ transferStore.uploadStopped }})
      </button>
      <span class="spacer" />
      <button type="button" class="st-btn" data-testid="uploads-start-all" @click="transferStore.startAll()">
        {{ t('start.all') }}
      </button>
      <button type="button" class="st-btn" data-testid="uploads-pause-all" @click="transferStore.stopAll()">
        {{ t('pause.all') }}
      </button>
      <button type="button" class="st-btn" data-testid="uploads-clear-finished" @click="onClearFinished">
        {{ t('clear.finished') }}
      </button>
      <button type="button" class="st-btn st-btn-danger" data-testid="uploads-clear-all" @click="onClearAll">
        {{ t('clear.all') }}
      </button>
    </div>

    <LongScrollList :trigger-size="100" @load-more="loadMore">
      <div v-if="filtered.length === 0" class="no-data">{{ t('nodata') }}</div>
      <div v-else class="task-list">
        <div v-for="(item, index) in visibleItems" :key="item.taskId" class="task-row" data-testid="upload-row">
          <div class="col-name">
            <span class="idx">{{ index + 1 }}.</span>
            <span class="name" :title="item.from && item.from.path">{{ item.from && item.from.name }}</span>
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
                data-testid="upload-row-message"
                :title="messageText(item)"
                @click="copyMessage(item)"
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
              data-testid="upload-row-pause"
              :title="t('pause.all')"
              @click="transferStore.pause(item.taskId)"
            >
              ‖
            </button>
            <button
              v-if="canRemove(item)"
              type="button"
              class="st-btn st-btn-mini"
              data-testid="upload-row-remove"
              :title="t('delete')"
              @click="removeItem(item)"
            >
              ×
            </button>
            <button
              v-if="canStart(item)"
              type="button"
              class="st-btn st-btn-mini st-btn-primary"
              data-testid="upload-row-start"
              :title="t('start.all')"
              @click="startItem(item)"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
      <div v-if="limitTo < filtered.length" class="bottom-tip">{{ t('loading.more') }}</div>
    </LongScrollList>
  </div>
</template>

<script setup>
// 等价 uploads 面板（app/main/files/transfer/uploads.html + uploads.js）：
// 任务行（名称+进度条/速度或状态/大小与百分比/操作），头部（搜索/失败与暂停筛选/启动全部/暂停全部/清空已完成/清空所有），
// long-scroll-list 100 分页，失败消息复制（message/EC Code/Request Id）。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LongScrollList from '../base/LongScrollList.vue';
import { useTransferStore } from '../../../stores/transfer.js';
import { useUiStore } from '../../../stores/ui.js';
import { useToastStore } from '../../../stores/toast.js';
import { sizeFormat } from '../../../services/file-size.js';

const { t } = useI18n();
const transferStore = useTransferStore();
const ui = useUiStore();
const toast = useToastStore();

const limitTo = ref(100);

function loadMore() {
  limitTo.value += 100;
}

const filtered = computed(() => {
  const kw = (transferStore.searchText || '').toLowerCase();
  if (!kw) return transferStore.uploads;
  return transferStore.uploads.filter((it) => {
    const name = (it.from && it.from.name) || '';
    if (kw === 'failed' || kw === 'stopped') {
      return it.status === kw;
    }
    return name.toLowerCase().indexOf(kw) !== -1 || it.status.indexOf(kw) !== -1;
  });
});

const visibleItems = computed(() => filtered.value.slice(0, limitTo.value));

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

function canPause(item) {
  return ['running', 'retrying', 'waiting', 'verifying'].indexOf(item.status) !== -1;
}

function canRemove(item) {
  return ['stopped', 'failed', 'finished'].indexOf(item.status) !== -1;
}

function canStart(item) {
  return item.status === 'stopped' || item.status === 'failed';
}

function startItem(item) {
  item.status = 'waiting';
  transferStore.checkStart();
}

function messageText(item) {
  return 'Message: ' + (item.message || '') + '\nEC Code: ' + (item.ecCode || '') + '\nRequest Id: ' + (item.requestId || '');
}

async function copyMessage(item) {
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (system && typeof system.clipboardWriteText === 'function') {
    try {
      await system.clipboardWriteText(messageText(item));
      toast.push(t('copy.successfully'), 'success', 1500);
    } catch (err) {
      /* 静默 */
    }
  }
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

async function onClearFinished() {
  transferStore.clearCompleted();
}

async function onClearAll() {
  const confirmed = await ui.confirm({
    title: t('clear.all.title'),
    message: t('clear.all.upload.message'),
    okText: t('delete'),
    cancelText: t('cancel'),
  });
  if (confirmed) {
    transferStore.stopCreatingJobs();
    transferStore.clearAll();
  }
}
</script>

<style scoped>
.uploads-panel {
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e5e5e5;
  max-height: 320px;
}
.panel-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
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
  color: #999;
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
  border-bottom: 1px solid #f7f7f7;
}
.col-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.col-name .idx {
  color: #999;
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
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
}
.bar-primary {
  background: #1890ff;
}
.bar-success {
  background: #52c41a;
}
.bar-danger {
  background: #f5222d;
}
.col-status {
  width: 110px;
  color: #666;
}
.col-size {
  width: 170px;
  color: #666;
}
.col-size .pct {
  margin-left: 6px;
  color: #999;
}
.col-actions {
  width: 70px;
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}
.st-btn {
  padding: 3px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.st-btn-danger {
  background: #d9534f;
  border-color: #d43f3a;
  color: #fff;
}
.st-btn-mini {
  padding: 0 5px;
  line-height: 18px;
}
.st-btn-primary {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}
.text-danger {
  color: #f5222d;
}
.msg {
  margin-left: 4px;
  color: #1890ff;
  font-style: normal;
  cursor: pointer;
}
.bottom-tip {
  text-align: center;
  padding: 4px;
  color: #999;
  font-size: 12px;
}
</style>