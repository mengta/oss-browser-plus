<template>
  <BaseModal :visible="true" :title="t('rename')" :mask-closable="false" @close="onCancel">
    <form class="rename-form" data-testid="rename-modal" @submit.prevent="onSubmit">
      <div class="form-group">
        <label>{{ t('folder.in') }}:</label>
        <div class="dir-path break">oss://{{ moveTo.bucket }}/{{ moveTo.key }}</div>
      </div>
      <div class="form-group" :class="errorClass">
        <label for="rename-name">{{ t('rename.to') }}:</label>
        <CleanableInput
          id="rename-name"
          ref="inputRef"
          v-model="name"
          name="name"
          data-testid="rename-name"
          @update:model-value="dirty = true"
        />
      </div>
    </form>
    <template #footer>
      <button
        type="button"
        class="st-btn st-btn-success"
        data-testid="rename-submit"
        :disabled="submitDisabled"
        @click="onSubmit"
      >
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="rename-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 rename-modal（app/main/files/modals/rename-modal.js）：
// 目录：checkFolderExists → 冲突确认（whetherCover.message1）→ 打开 move 弹窗（renamePath）；
// 文件：checkFileExists → 已存在则确认（whetherCover.message2）→ moveFile(isCopy)；
// 目录无冲突直接走 move 弹窗（copyFiles + removeAfterCopy，等价原版 showMoveFolder）。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import CleanableInput from '../../base/CleanableInput.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useFilesStore } from '../../../stores/files.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';

const props = defineProps({
  item: { type: Object, required: true },
  moveTo: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
  isCopy: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const filesStore = useFilesStore();
const toast = useToastStore();
const ui = useUiStore();

const name = ref(props.item.name || '');
const originalName = props.item.name || '';
const loading = ref(false);
const dirty = ref(false);
const inputRef = ref(null);

const errorClass = computed(() => ({ 'has-error': dirty.value && !(name.value || '') }));

// 等价原版按钮禁用条件：加载中，或名称未改且目标目录即当前目录
const submitDisabled = computed(
  () =>
    loading.value ||
    (name.value === originalName && String(props.moveTo.key || '') === String(props.currentInfo.key || ''))
);

onMounted(() => {
  const el = inputRef.value && inputRef.value.$el && inputRef.value.$el.querySelector('input');
  if (el) el.focus();
});

function onCancel() {
  emit('close');
}

function targetPath() {
  const key = String(props.moveTo.key || '').replace(/\/$/, '');
  const base = key ? key + '/' : '';
  return base + (name.value || '') + (props.item.isFolder ? '/' : '');
}

function refreshList() {
  setTimeout(() => filesStore.loadObjects(true), 300);
}

function onSubmit() {
  if (!name.value || loading.value) {
    dirty.value = true;
    return;
  }
  const newPath = targetPath();
  const info = props.currentInfo || {};
  if (props.item.path === newPath) return;

  loading.value = true;

  if (props.item.isFolder) {
    ossClient
      .checkFolderExists(props.moveTo.region, props.moveTo.bucket, newPath)
      .then((has) => {
        if (!has) {
          openMove(newPath);
          return;
        }
        ui.confirm(t('whetherCover.title'), t('whetherCover.message1')).then((ok) => {
          if (ok) openMove(newPath);
          else loading.value = false;
        });
      })
      .catch(() => {
        loading.value = false;
      });
    return;
  }

  ossClient
    .checkFileExists(props.moveTo.region, props.moveTo.bucket, newPath)
    .then(() => {
      ui.confirm(t('whetherCover.title'), t('whetherCover.message2')).then((ok) => {
        if (ok) renameFile(newPath);
        else loading.value = false;
      });
    })
    .catch(() => {
      renameFile(newPath);
    });

  function renameFile(path) {
    toast.push(t('rename.on'), 'info', 1500);
    ossClient
      .moveFile(info.region, info.bucket, props.item.path, path, props.isCopy)
      .then(() => {
        toast.push(t('rename.success'), 'success', 2000);
        loading.value = false;
        refreshList();
        emit('close', true);
      })
      .catch(() => {
        loading.value = false;
      });
  }
}

function openMove(newPath) {
  ui
    .open('move', {
      items: [props.item],
      moveTo: props.moveTo,
      isCopy: props.isCopy,
      renamePath: newPath,
      fromInfo: props.currentInfo,
      onComplete: () => {
        toast.push(t('rename.success'), 'success', 2000);
        loading.value = false;
        refreshList();
        emit('close', true);
      },
    })
    .then((result) => {
      if (!result && loading.value) loading.value = false;
    });
}
</script>

<style scoped>
.rename-form {
  min-width: 420px;
}
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.form-group label {
  width: 96px;
  text-align: right;
  color: var(--vsc-fg-muted);
}
.form-group :deep(.cleanable-input) {
  flex: 1;
}
.dir-path {
  flex: 1;
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
.break {
  word-break: break-all;
}
.has-error :deep(.cleanable-input-el) {
  border-color: var(--vsc-danger);
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