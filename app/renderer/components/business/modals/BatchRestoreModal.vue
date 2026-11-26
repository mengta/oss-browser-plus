<template>
  <BaseModal :visible="true" :title="t('restore.title')" :mask-closable="false" @close="onCancel">
    <form class="batch-restore-form" data-testid="batch-restore-modal" @submit.prevent="onSubmit">
      <div class="form-group">
        <div class="label-line">{{ t('file') }}:</div>
        <ul class="file-list">
          <li v-for="item in items" :key="item.path" class="break" data-testid="batch-restore-item">
            <AppIcon :name="item.isFolder ? 'folder' : 'file'" :class="item.isFolder ? 'text-folder' : ''" />
            oss://{{ currentInfo.bucket }}/{{ currentInfo.key }}{{ item.name }}
          </li>
        </ul>
      </div>

      <div v-if="isLoading" class="loading">{{ t('loading') }}</div>

      <div v-if="!isLoading && stateType === 2" class="alert alert-warning" data-testid="batch-restore-onprogress">
        {{ t('restore.onprogress') }}
      </div>

      <div v-if="!isLoading && stateType === 3" class="alert alert-success" data-testid="batch-restore-expiry">
        {{ t('restore.message2') }}: {{ expiryDate }}
      </div>

      <div v-if="!isLoading && stateType === 1" class="form-group" data-testid="batch-restore-days-row">
        <label for="batch-restore-days">{{ t('restore.days') }}:</label>
        <div class="days-box">
          <input
            id="batch-restore-days"
            v-model.number="days"
            type="number"
            data-testid="batch-restore-days"
            min="1"
            max="7"
            step="1"
            required
            class="form-control"
          />
          <div class="tips">{{ t('restore.days.tips.7') }}</div>
        </div>
      </div>
    </form>
    <template #footer>
      <button
        type="button"
        class="st-btn st-btn-success"
        data-testid="batch-restore-submit"
        :disabled="isLoading"
        @click="onSubmit"
      >
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="batch-restore-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 batch-restore-modal（app/main/files/_/batch-restore-modal.js + modals/batch-restore-modal.html）：
// 逐项 HEAD 判定恢复状态（任一恢复中→2；否则任一已恢复→3；否则→1 可提交），
// 提交对每项 restoreFile → 全部完成 Toast 成功 → 就地刷新状态 → 关闭。
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import AppIcon from '../../base/AppIcon.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';
import { applyRestoreState, restoreStateOf } from '../../../services/restore-info.js';

const props = defineProps({
  items: { type: Array, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();

const isLoading = ref(true);
const days = ref(1);
const stateType = ref(1);
const expiryDate = ref('');

onMounted(() => {
  const info = props.currentInfo || {};
  const list = props.items || [];
  Promise.all(
    list.map((item) =>
      ossClient
        .getFileInfo(info.region, info.bucket, item.path)
        .then((meta) => restoreStateOf(meta))
        .catch(() => ({ type: 1, expiryDate: '' }))
    )
  )
    .then((states) => {
      if (states.some((s) => s.type === 2)) {
        stateType.value = 2;
      } else if (states.some((s) => s.type === 3)) {
        stateType.value = 3;
        expiryDate.value = (states.find((s) => s.type === 3) || {}).expiryDate || '';
      } else {
        stateType.value = 1;
      }
    })
    .finally(() => {
      isLoading.value = false;
    });
});

function onCancel() {
  emit('close');
}

function onSubmit() {
  if (isLoading.value) return;
  const info = props.currentInfo || {};
  const list = props.items || [];
  toast.push(t('restore.on'), 'info', 1500);
  Promise.all(
    list.map((item) => ossClient.restoreFile(info.region, info.bucket, item.path, days.value || 7))
  )
    .then(() => {
      toast.push(t('restore.success'), 'success', 2000);
      return applyRestoreState(ossClient, info, list);
    })
    .then(() => emit('close', true))
    .catch(() => {});
}
</script>

<style scoped>
.batch-restore-form {
  min-width: 460px;
  max-width: 640px;
}
.form-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.form-group > label {
  width: 64px;
  text-align: right;
  color: var(--vsc-fg-muted);
}
.label-line {
  color: var(--vsc-fg-muted);
}
.file-list {
  margin: 4px 0 0;
  padding-left: 4px;
  list-style: none;
  max-height: 200px;
  overflow: auto;
}
.file-list li {
  padding: 2px 0;
}
.break {
  word-break: break-all;
}
.days-box {
  flex: 1;
}
.form-control {
  width: 120px;
}
.tips {
  margin-top: 4px;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
.alert {
  padding: 8px 12px;
  border-radius: 2px;
  margin: 8px 0;
}
.alert-warning {
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
}
.alert-success {
  background: var(--vsc-success-bg);
  color: var(--vsc-success);
}
.loading {
  color: var(--vsc-fg-muted);
  padding: 6px 0;
}
.text-folder {
  color: var(--vsc-highlight);
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
.st-btn-success {
  background: var(--vsc-success-solid);
  border-color: var(--vsc-success);
  color: var(--vsc-on-accent);
}
</style>