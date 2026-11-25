<template>
  <BaseModal
    :visible="true"
    :title="title"
    @close="onCancel"
  >
    <div class="confirm-dialog-body" :class="'text-' + cls">
      <h5 class="cd-message break">{{ message }}</h5>
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
        {{ t('ok') }}
      </button>
      <button
        v-if="kind !== 'alert'"
        type="button"
        class="cd-btn cd-btn-default"
        data-testid="dialog-cancel"
        @click="onCancel"
      >
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from './BaseModal.vue';

// 等价 dialog.html + alertDialogCtrl/confirmDialogCtrl：
// alert 仅确定钮；确定 resolve(true)；取消/Esc/×/遮罩 resolve(false)
defineProps({
  kind: { type: String, default: 'confirm' },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  cls: { type: String, default: 'primary' },
});

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
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.cd-btn-primary {
  border-color: #337ab7;
  background: #337ab7;
  color: #fff;
}
.cd-btn-danger {
  border-color: #d9534f;
  background: #d9534f;
  color: #fff;
}
.cd-btn-warning {
  border-color: #f0ad4e;
  background: #f0ad4e;
  color: #fff;
}
.cd-btn-success {
  border-color: #5cb85c;
  background: #5cb85c;
  color: #fff;
}
</style>