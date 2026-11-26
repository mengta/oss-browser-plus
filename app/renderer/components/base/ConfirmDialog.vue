<template>
  <BaseModal
    :visible="true"
    :title="title"
    @close="onCancel"
  >
    <div class="confirm-dialog-body" :class="'text-' + cls">
      <h5 class="cd-message break">{{ displayMessage }}</h5>
    </div>
    <template #footer>
      <button
        ref="okBtn"
        type="button"
        class="btn-sm cd-btn"
        :class="'cd-btn-' + cls"
        data-testid="dialog-ok"
        @click="onOk"
      >
        {{ okText || t('ok') }}
      </button>
      <button
        v-if="kind !== 'alert'"
        type="button"
        class="cd-btn cd-btn-default"
        data-testid="dialog-cancel"
        @click="onCancel"
      >
        {{ cancelText || t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from './BaseModal.vue';

// 等价 dialog.html + alertDialogCtrl/confirmDialogCtrl：
// alert 仅确定钮；确定 resolve(true)；取消/Esc/×/遮罩 resolve(false)
const props = defineProps({
  kind: { type: String, default: 'confirm' },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  cls: { type: String, default: 'primary' },
  okText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
});

// 原版 Dialog 以 ng-bind-html 渲染文案（含 <code>/<span class="text-info"> 高亮）；
// Vue 版按纯文本展示，去掉标签保留文字内容（与 B2 确认框渲染口径一致）。
const displayMessage = computed(() => String(props.message || '').replace(/<[^>]+>/g, ''));

const emit = defineEmits(['ok', 'cancel']);
const { t } = useI18n();
const okBtn = ref(null);

function onOk() {
  emit('ok');
}

function onCancel() {
  emit('cancel');
}

onMounted(() => {
  if (okBtn.value) {
    okBtn.value.focus();
  }
});
</script>

<style scoped>
.confirm-dialog-body {
  min-width: 280px;
  max-width: 560px;
}
.cd-message {
  margin: 0;
  font-weight: normal;
  word-break: break-word;
  white-space: pre-wrap;
}
.break {
  word-break: break-all;
}
.cd-btn {
  padding: 4px 14px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.cd-btn-primary {
  border-color: var(--vsc-accent);
  background: var(--vsc-accent);
  color: var(--vsc-on-accent);
}
.cd-btn-danger {
  border-color: var(--vsc-danger);
  background: var(--vsc-danger-solid);
  color: var(--vsc-on-accent);
}
.cd-btn-warning {
  border-color: var(--vsc-warning);
  background: var(--vsc-warning-solid);
  color: var(--vsc-on-accent);
}
.cd-btn-success {
  border-color: var(--vsc-success);
  background: var(--vsc-success-solid);
  color: var(--vsc-on-accent);
}
</style>