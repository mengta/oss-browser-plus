<template>
  <BaseModal :visible="true" :title="title" :mask-closable="false" @close="onCancel">
    <DiffEditor ref="editor" :original="originalContent" :model-value="content" :readonly="!editable" />
    <template #footer>
      <button v-if="editable" type="button" class="st-btn st-btn-primary" data-testid="diff-ok" @click="onOk">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="diff-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import DiffEditor from '../../base/DiffEditor.vue';

// 等价 diffModalCtrl：editable 时确定回调 getValue，否则取消无回调；均关闭弹窗。
const props = defineProps({
  title: { type: String, default: 'Diff' },
  editable: { type: Boolean, default: true },
  originalContent: { type: String, default: '' },
  content: { type: String, default: '' },
});

const emit = defineEmits(['close']);
const { t } = useI18n();

const editor = ref(null);

function onCancel() {
  emit('close');
}

function onOk() {
  const value = editor.value ? editor.value.getValue() : props.content;
  emit('close', value);
}
</script>

<style scoped>
.st-btn {
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.st-btn-primary {
  background: #337ab7;
  border-color: #2e6da4;
  color: #fff;
}
</style>