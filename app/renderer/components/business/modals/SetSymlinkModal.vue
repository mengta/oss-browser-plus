<template>
  <BaseModal :visible="true" :title="t('file.op.set_symlink')" :mask-closable="false" @close="onCancel">
    <form class="symlink-form" data-testid="symlink-modal" @submit.prevent="onSubmit">
      <div class="form-group">
        <label class="w-label">{{ t('file.attr.symlink_src') }}</label>
        <div class="value break">{{ item.name }}</div>
      </div>

      <div class="form-group">
        <label class="w-label" for="symlink-target">{{ t('file.attr.symlink_file') }}</label>
        <div class="value">
          <input
            id="symlink-target"
            v-model="targetName"
            type="text"
            data-testid="symlink-target"
            required
            class="form-control"
          />
          <pre class="rule">{{ ruleText }}</pre>
        </div>
      </div>
    </form>
    <template #footer>
      <button type="button" class="st-btn st-btn-success" data-testid="symlink-submit" @click="onSubmit">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="symlink-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 set-symlink-modal（app/main/files/modals/set-symlink-modal.js）：
// 目标名校验（emoji / .. / 连续 // / 首尾斜杠）→ putObjectSymlinkMeta(region,bucket,targetName,item.path)
// → Toast setup.success → 同目录时刷新列表 → 关闭。错误文案 Toast 展示。
// emoji 判定使用内联正则（B3-10 纯函数化，替代渲染层 emoji-regex 依赖）。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useFilesStore } from '../../../stores/files.js';
import { useToastStore } from '../../../stores/toast.js';

const REG_EMOJI = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
const REG_2DOTS = /^\.\.$|\/\.\.\/?$|\/\.\.\//;
const REG_LEADING_SLASH = /^(\/|\\)/;
const REG_END_SLASH = /(\/|\\)$/;
const REG_CONTINUOUS_SLASH = /\/\//;

const props = defineProps({
  item: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();
const filesStore = useFilesStore();

const targetName = ref('');

// 原版规则文案为 HTML（含 <br/> 与 {{min}}/{{max}}），此处去标签并保留换行
const ruleText = computed(() =>
  String(t('file.message.symlink_rule{min,max}!html!lines', { min: 1, max: 254 }) || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
);

function validate(value) {
  if (REG_EMOJI.test(value)) return t('file.md.name.error.emoji');
  if (REG_2DOTS.test(value)) return t('file.md.name.error.2dots');
  if (REG_CONTINUOUS_SLASH.test(value)) return t('file.md.name.error.continuous slash');
  if (REG_LEADING_SLASH.test(value)) return t('file.message.validation_end_slash!html');
  if (REG_END_SLASH.test(value)) return t('file.message.validation_end_slash!html');
  return '';
}

function onCancel() {
  emit('close');
}

function sameFolder(target) {
  const path = String(props.item.path || '');
  const lastSlash = path.lastIndexOf('/');
  const targetSlash = String(target).lastIndexOf('/');
  if (lastSlash === -1 && targetSlash === -1) return true;
  return path.slice(0, lastSlash) === String(target).slice(0, targetSlash);
}

function onSubmit() {
  const value = String(targetName.value || '');
  const error = validate(value);
  if (error) {
    toast.push(error, 'danger', 3000);
    return;
  }

  const info = props.currentInfo || {};
  ossClient
    .putObjectSymlinkMeta(info.region, info.bucket, value, props.item.path)
    .then(() => {
      toast.push(t('setup.success'), 'success', 2000);
      if (sameFolder(value)) {
        setTimeout(() => filesStore.loadObjects(true), 300);
      }
      emit('close', true);
    })
    .catch((err) => {
      toast.push((err && err.message) || 'set symlink failed', 'danger', 4000);
    });
}
</script>

<style scoped>
.symlink-form {
  min-width: 480px;
  max-width: 640px;
}
.form-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.w-label {
  width: 150px;
  text-align: right;
  color: var(--vsc-fg-muted);
}
.value {
  flex: 1;
  min-width: 0;
}
.form-control {
  width: 100%;
}
.rule {
  margin: 4px 0 0;
  color: var(--vsc-fg-muted);
  font-size: 12px;
  white-space: pre-line;
  font-family: inherit;
}
.break {
  word-break: break-all;
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
  background: var(#2ea043);
  border-color: #2ea043;
  color: var(--vsc-on-accent);
}
</style>