<template>
  <BaseModal :visible="true" :title="t('simplePolicy.title')" :mask-closable="false" cls="danger" @close="onClose">
    <div class="grant-code" data-testid="grant-code-modal">
      <div class="title">{{ t('auth.tokenLogin') }}:</div>
      <pre class="code" data-testid="grant-code-content">{{ code }}</pre>
      <a href="javascript:void(0)" data-testid="grant-code-copy" @click="copy">{{ t('click.copy') }}</a>
    </div>
    <template #footer>
      <button type="button" class="st-btn" data-testid="grant-code-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 grant-modal-code（app/main/files/modals/grant-modal-code.js + html）：
// 从授权邮件 HTML 中提取 <code> 授权码内容展示并复制。
// 原版以 trustAsHtml 渲染，Vue 版按纯文本展示（内容一致，去 HTML 标签）。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { useToastStore } from '../../../stores/toast.js';

const props = defineProps({
  info: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();

const code = computed(() => {
  const html = String((props.info && props.info.html) || '');
  const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  return match ? match[1] : '';
});

function copy() {
  if (!code.value) return;
  toast.copy({ message: code.value }).then((res) => {
    if (res && res.ok === true) {
      toast.push(t('copy.successfully'), 'success', 2000);
    }
  });
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.grant-code {
  min-width: 420px;
  max-width: 640px;
}
.title {
  color: var(--vsc-success);
  margin-bottom: 6px;
}
.code {
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--vsc-bg-hover);
  padding: 8px;
  border-radius: 2px;
  font-size: 12px;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
</style>