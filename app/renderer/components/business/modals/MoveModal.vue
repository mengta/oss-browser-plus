<template>
  <BaseModal
    :visible="true"
    :title="isCopy ? t('copy') : t('move')"
    :mask-closable="false"
    @close="onClose"
  >
    <div class="move-modal" data-testid="move-modal">
      <div v-if="step === 2" class="text-info">{{ isCopy ? t('copy.on') : t('move.on') }}...</div>

      <div v-if="step === 2 || step === 3">
        <div class="progress" data-testid="move-progress">
          <div class="progress-bar progress-bar-success" :style="{ width: successWidth }" />
          <div class="progress-bar progress-bar-danger" :style="{ width: errorWidth }" />
        </div>
        <label class="progress-label">{{ progress.current }} / {{ progress.total }}</label>
      </div>

      <div v-if="step === 3">
        <div v-if="failures.length > 0" class="text-warning" data-testid="move-failures">
          <div v-if="isStop" class="text-danger">{{ t('use.cancelled') }}</div>
          <div>{{ isCopy ? t('copy.error1') : t('move.error1') }}</div>
          <ul class="file-list">
            <li v-for="(failure, index) in shownFailures" :key="index" data-testid="move-failure">
              <AppIcon :name="failure.item.isFolder ? 'folder' : 'file'" :class="failure.item.isFolder ? 'text-folder' : ''" />
              {{ shortPath(failure.item.path) }}
              <AppIcon name="warning" class="text-danger" :title="failure.message" />
            </li>
            <li v-if="failures.length > 10">......</li>
          </ul>
        </div>
        <div v-else class="text-success" data-testid="move-success">
          <AppIcon name="check" class="text-success" />
          {{ isCopy ? t('copy.success') : t('move.success') }}
        </div>
      </div>
    </div>

    <template #footer>
      <button
        v-if="step === 2"
        type="button"
        class="st-btn st-btn-warning"
        data-testid="move-stop"
        :disabled="isStop"
        @click="stop"
      >
        {{ t('stop') }}
      </button>
      <button v-if="step === 3" type="button" class="st-btn" data-testid="move-close" @click="onClose">
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 move-modal（app/main/files/modals/move-modal.js）：
// 打开即执行 copyFiles（fromInfo.region + items.bucket + moveTo 目标 + removeAfterCopy=!isCopy + renamePath），
// 完成后展示 copyFiles 返回的逐项失败明细（最多 10 条）；停止按钮调 stopCopyFiles。
// 原版 template 引用不存在的 currentInfo.key（缺陷），此处按 fromInfo.key 截断相对路径。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import AppIcon from '../../base/AppIcon.vue';
import { ossClient } from '../../../services/oss-client.js';

const props = defineProps({
  items: { type: Array, required: true },
  moveTo: { type: Object, required: true },
  fromInfo: { type: Object, required: true },
  isCopy: { type: Boolean, default: false },
  renamePath: { type: String, default: '' },
  onComplete: { type: Function, default: null },
});

const emit = defineEmits(['close']);
const { t } = useI18n();

const step = ref(2);
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
  const base = String((props.fromInfo && props.fromInfo.key) || '');
  const full = String(path || '');
  return base && full.indexOf(base) === 0 ? full.slice(base.length) : full;
}

function normalizeFailures(value) {
  if (value && Array.isArray(value.failures)) {
    return value.failures;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => ({
      item: (entry && entry.item) || {},
      message:
        (entry && entry.error && entry.error.message) ||
        (entry && entry.message) ||
        'unknown error',
    }));
  }
  return [
    {
      item: { path: '', name: '', isFolder: false },
      message: (value && value.message) || String(value || 'unknown error'),
    },
  ];
}

onMounted(() => {
  start();
});

function start() {
  step.value = 2;
  isStop.value = false;
  failures.value = [];
  progress.value = { current: 0, total: 0, errorCount: 0 };
  const from = props.fromInfo || {};
  const to = props.moveTo || {};
  const target = { region: to.region, bucket: to.bucket, key: String(to.key || '') };
  const list = (props.items || []).map((item) => Object.assign({}, item, { bucket: from.bucket }));

  ossClient
    .copyFiles(
      from.region,
      list,
      target,
      (prog) => {
        progress.value = Object.assign({ current: 0, total: 0, errorCount: 0 }, prog || {});
      },
      !props.isCopy,
      props.renamePath || ''
    )
    .then((terr) => {
      failures.value = normalizeFailures(terr);
    })
    .catch((err) => {
      failures.value = normalizeFailures(err);
    })
    .finally(() => {
      step.value = 3;
      if (typeof props.onComplete === 'function') {
        props.onComplete(failures.value);
      }
    });
}

function stop() {
  isStop.value = true;
  ossClient.stopCopyFiles().catch(() => {});
}

function onClose() {
  emit('close', failures.value.length === 0);
}
</script>

<style scoped>
.move-modal {
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
.st-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.st-btn-warning {
  background: var(#8a6d00);
  border-color: #8a6d00;
  color: var(--vsc-on-accent);
}
</style>