<template>
  <BaseModal :visible="true" :title="t('deleteModal.title')" :mask-closable="false" @close="onClose">
    <div class="delete-files" data-testid="delete-files-modal">
      <div v-if="step === 1" class="step-confirm">
        <div class="text-warning">{{ t('deleteModal.message1') }}:</div>
        <ul class="file-list">
          <li v-for="item in items" :key="item.path || item.name" class="break" data-testid="delete-files-item">
            <AppIcon :name="item.isFolder ? 'folder' : 'file'" :class="item.isFolder ? 'text-folder' : ''" />
            {{ item.name }}
          </li>
        </ul>
      </div>

      <div v-if="step === 2" class="text-info">{{ t('delete.on') }}</div>

      <div v-if="step === 2 || step === 3">
        <div class="progress" data-testid="delete-files-progress">
          <div class="progress-bar progress-bar-success" :style="{ width: successWidth }" />
          <div class="progress-bar progress-bar-danger" :style="{ width: errorWidth }" />
        </div>
        <label class="progress-label">{{ progress.current }} / {{ progress.total }}</label>
      </div>

      <div v-if="step === 3">
        <div v-if="failures.length > 0" class="text-warning" data-testid="delete-files-failures">
          <div v-if="isStop" class="text-danger">{{ t('deleteModal.message2') }}</div>
          <div>{{ t('deleteModal.message3') }}:</div>
          <ul class="file-list">
            <li v-for="(failure, index) in shownFailures" :key="index" data-testid="delete-files-failure">
              <AppIcon :name="failure.item.isFolder ? 'folder' : 'file'" :class="failure.item.isFolder ? 'text-folder' : ''" />
              {{ shortPath(failure.item.path) }}
              <AppIcon name="warning" class="text-danger" :title="failure.message" />
            </li>
            <li v-if="failures.length > 10">......</li>
          </ul>
        </div>
        <div v-else class="text-success" data-testid="delete-files-success">
          <AppIcon name="check" class="text-success" />
          {{ t('delete.success') }}
        </div>
      </div>
    </div>

    <template #footer>
      <button
        v-if="step === 1"
        type="button"
        class="st-btn st-btn-danger"
        data-testid="delete-files-confirm"
        @click="start"
      >
        {{ t('ok') }}
      </button>
      <button
        v-if="step === 2"
        type="button"
        class="st-btn st-btn-warning"
        data-testid="delete-files-stop"
        :disabled="isStop"
        @click="stop"
      >
        {{ t('stop') }}
      </button>
      <button
        v-if="step === 1 || step === 3"
        type="button"
        class="st-btn"
        data-testid="delete-files-close"
        @click="onClose"
      >
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 delete-files-modal（app/main/files/modals/delete-files-modal.js + html）：
// step1 确认清单 → step2 进度（成功/失败双色条 + current/total + 停止）→
// step3 结果（失败项最多 10 条 + tooltip；用户停止时附提示；全成功显示删除成功）。
// 原版 callback 在 then/catch 均刷新列表（延迟 300ms），此处保持。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import AppIcon from '../../base/AppIcon.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useFilesStore } from '../../../stores/files.js';

const props = defineProps({
  items: { type: Array, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const filesStore = useFilesStore();

const step = ref(1);
const isStop = ref(false);
const progress = ref({ current: 0, total: 0, errorCount: 0 });
const failures = ref([]);

const shownFailures = computed(() => failures.value.slice(0, 10));

function widthOf(count) {
  const total = progress.value.total || 0;
  if (total <= 0) return '0%';
  return (count * 100) / total + '%';
}

const successWidth = computed(() => widthOf(progress.value.current));
const errorWidth = computed(() => widthOf(progress.value.errorCount));

function shortPath(path) {
  const info = props.currentInfo || {};
  const full = String(path || '');
  const base = String(info.key || '');
  return base && full.indexOf(base) === 0 ? full.slice(base.length) : full;
}

function normalizeFailures(err) {
  if (err && Array.isArray(err.failures)) {
    return err.failures;
  }
  if (Array.isArray(err)) {
    return err.map((entry) => ({
      item: (entry && entry.item) || {},
      message: (entry && entry.error && entry.error.message) || 'unknown error',
    }));
  }
  // 原版对非数组错误会误显示“删除成功”；此处按失败展示（可判定改进）
  return [
    {
      item: { path: '', name: '', isFolder: false },
      message: (err && err.message) || String(err || 'unknown error'),
    },
  ];
}

function refreshList() {
  setTimeout(() => filesStore.loadObjects(true), 300);
}

function start() {
  step.value = 2;
  isStop.value = false;
  failures.value = [];
  progress.value = { current: 0, total: 0, errorCount: 0 };
  const info = props.currentInfo || {};
  ossClient
    .deleteFiles(info.region, info.bucket, props.items, (prog) => {
      progress.value = Object.assign({ current: 0, total: 0, errorCount: 0 }, prog || {});
    })
    .then(() => {
      failures.value = [];
    })
    .catch((err) => {
      failures.value = normalizeFailures(err);
    })
    .finally(() => {
      step.value = 3;
      refreshList();
    });
}

function stop() {
  isStop.value = true;
  ossClient.stopDeleteFiles().catch(() => {});
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.delete-files {
  min-width: 420px;
  max-width: 640px;
}
.file-list {
  margin: 8px 0 0;
  padding-left: 4px;
  list-style: none;
  max-height: 240px;
  overflow: auto;
}
.file-list li {
  padding: 2px 0;
}
.break {
  word-break: break-all;
}
.progress {
  display: flex;
  height: 14px;
  margin: 8px 0 4px;
  background: var(--vsc-bg-hover);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
}
.progress-bar-success {
  background: var(#2ea043);
}
.progress-bar-danger {
  background: var(#a1260d);
}
.progress-label {
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
.text-warning {
  color: var(--vsc-warning);
}
.text-danger {
  color: #a1260d;
}
.text-success {
  color: var(--vsc-success);
}
.text-info {
  color: var(--vsc-link);
}
.text-folder {
  color: #dcb67a;
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
.st-btn-warning {
  background: var(#8a6d00);
  border-color: #8a6d00;
  color: var(--vsc-on-accent);
}
</style>