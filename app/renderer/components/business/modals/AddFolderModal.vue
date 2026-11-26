<template>
  <BaseModal :visible="true" :title="t('folder.create')" :mask-closable="false" @close="onCancel">
    <form class="add-folder-form" data-testid="add-folder-modal" @submit.prevent="onSubmit">
      <div class="form-group" :class="errorClass">
        <label for="add-folder-name">{{ t('folder.name') }}:</label>
        <CleanableInput
          id="add-folder-name"
          ref="inputRef"
          v-model="name"
          name="name"
          data-testid="add-folder-name"
          @update:model-value="dirty = true"
        />
      </div>
    </form>
    <template #footer>
      <button type="button" class="st-btn st-btn-success" data-testid="add-folder-submit" @click="onSubmit">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="add-folder-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 add-folder-modal（app/main/files/modals/add-folder-modal.js）：
// 目录名必填且不含 /（原 pattern /^[^/]+$/）→ createFolder(key + name + '/') →
// Toast folder.create.success → 关闭 → 300ms 后刷新列表。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import CleanableInput from '../../base/CleanableInput.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useFilesStore } from '../../../stores/files.js';
import { useToastStore } from '../../../stores/toast.js';

const FOLDER_NAME_REG = /^[^/]+$/;

const props = defineProps({
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const filesStore = useFilesStore();
const toast = useToastStore();

const name = ref('');
const dirty = ref(false);
const inputRef = ref(null);

const valid = computed(() => FOLDER_NAME_REG.test(name.value || ''));
const errorClass = computed(() => ({
  'has-error': dirty.value && !valid.value,
  'has-success': dirty.value && valid.value,
}));

onMounted(() => {
  const el = inputRef.value && inputRef.value.$el && inputRef.value.$el.querySelector('input');
  if (el) el.focus();
});

function onCancel() {
  emit('close');
}

function onSubmit() {
  if (!valid.value) {
    dirty.value = true;
    return;
  }
  const info = props.currentInfo || {};
  ossClient
    .createFolder(info.region, info.bucket, String(info.key || '') + name.value + '/')
    .then(() => {
      toast.push(t('folder.create.success'), 'success', 2000);
      setTimeout(() => filesStore.loadObjects(true), 300);
      emit('close', true);
    })
    .catch(() => {});
}
</script>

<style scoped>
.add-folder-form {
  min-width: 360px;
}
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-group label {
  width: 96px;
  text-align: right;
  color: var(--vsc-fg-muted);
}
.form-group :deep(.cleanable-input) {
  flex: 1;
}
.has-error :deep(.cleanable-input-el) {
  border-color: var(--vsc-danger);
}
.has-success :deep(.cleanable-input-el) {
  border-color: var(--vsc-success);
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-success {
  background: var(--vsc-success-solid);
  border-color: var(--vsc-success);
  color: var(--vsc-on-accent);
}
</style>