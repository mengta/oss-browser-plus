<template>
  <BaseModal :visible="true" :title="t('restore.title')" :mask-closable="false" @close="onCancel">
    <form class="restore-form" data-testid="restore-modal" @submit.prevent="onSubmit">
      <div class="form-group">
        <label>{{ t('file') }}:</label>
        <div class="break">oss://{{ currentInfo.bucket }}/{{ currentInfo.key }}{{ item.name }}</div>
      </div>

      <div v-if="isLoading" class="loading">{{ t('loading') }}</div>

      <div v-if="!isLoading && state.type === 2" class="alert alert-warning" data-testid="restore-onprogress">
        {{ t('restore.onprogress') }}
      </div>

      <div v-if="!isLoading && state.type === 3" class="alert alert-success" data-testid="restore-expiry">
        {{ t('restore.message2') }}: {{ state.expiryDate }}
      </div>

      <div v-if="!isLoading && state.type === 1" class="form-group" data-testid="restore-days-row">
        <label for="restore-days">{{ t('restore.days') }}:</label>
        <div class="days-box">
          <input
            id="restore-days"
            v-model.number="days"
            type="number"
            data-testid="restore-days"
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
        data-testid="restore-submit"
        :disabled="isLoading"
        @click="onSubmit"
      >
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="restore-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 restore-modal（app/main/files/modals/restore-modal.js）：
// 打开即 HEAD 对象判定恢复状态（1 未恢复 / 2 恢复中 / 3 已恢复可读），
// 提交 restoreFile(region,bucket,path,days) → Toast → 就地刷新恢复状态 → 关闭。
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';

import { ossClient } from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';
import { applyRestoreState, restoreStateOf } from '../../../services/restore-info.js';

const props = defineProps({
  item: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();

const isLoading = ref(true);
const days = ref(1);
const state = reactive({ type: 1, expiryDate: '' });

onMounted(() => {
  const info = props.currentInfo || {};
  ossClient
    .getFileInfo(info.region, info.bucket, props.item.path)
    .then((meta) => {
      Object.assign(state, restoreStateOf(meta));
    })
    .catch(() => {
      state.type = 1;
      state.expiryDate = '';
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
  toast.push(t('restore.on'), 'info', 1500);
  ossClient
    .restoreFile(info.region, info.bucket, props.item.path, days.value || 7)
    .then(() => {
      toast.push(t('restore.success'), 'success', 2000);
      return applyRestoreState(ossClient, info, [props.item]);
    })
    .then(() => emit('close', true))
    .catch(() => {});
}

</script>

<style scoped>
.restore-form {
  min-width: 420px;
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
  background: var(#2ea043);
  border-color: #2ea043;
  color: var(--vsc-on-accent);
}
</style>