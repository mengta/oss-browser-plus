<template>
  <BaseModal :visible="true" :title="t('preview') + ' (' + sizeText + ')'" :mask-closable="false" @close="onClose">
    <div class="preview-modal" data-testid="doc-modal">
      <header class="path break">oss://{{ bucketInfo.bucket }}/{{ objectInfo.path }}</header>
      <RestoreChecker :bucket-info="bucketInfo" :object-info="objectInfo" :file-type="fileType">
        <div class="content">
          <div class="alert-warning" data-testid="doc-unsupported">{{ t('cannot.preview.this.file') }}</div>
        </div>
      </RestoreChecker>
    </div>
    <template #footer>
      <PreviewBar :object-info="objectInfo" :bucket-info="bucketInfo" />
      <span class="spacer" />
      <button type="button" class="st-btn" data-testid="doc-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 doc-modal（app/main/files/modals/preview/doc-modal.js）：
// 原版 iframe/IMM 预览已自身注释禁用，仅保留“该文件类型无法预览”提示 + 预览操作栏。
// 原版 showAsCodeBtn 未在控制器定义（pdf 也不在文本白名单），因此不提供“作为文本打开”按钮（保持等价）。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import RestoreChecker from './RestoreChecker.vue';
import PreviewBar from './PreviewBar.vue';
import { sizeFormat } from '../../../services/file-size.js';

const props = defineProps({
  objectInfo: { type: Object, required: true },
  bucketInfo: { type: Object, required: true },
  fileType: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const sizeText = computed(() => sizeFormat(props.objectInfo.size));

function onClose() {
  emit('close');
}
</script>

<style scoped>
.preview-modal {
  min-width: 560px;
  max-width: 90vw;
}
.path {
  padding: 6px 10px;
  background: var(--vsc-success-bg);
  color: var(--vsc-success);
  font-size: 12px;
}
.break {
  word-break: break-all;
}
.content {
  padding: 12px;
}
.alert-warning {
  padding: 12px;
  text-align: center;
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
  border-radius: 2px;
}
.spacer {
  flex: 1;
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