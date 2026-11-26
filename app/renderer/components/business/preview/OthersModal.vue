<template>
  <BaseModal :visible="true" :title="t('preview') + ' (' + sizeText + ')'" :mask-closable="false" @close="onClose">
    <div class="preview-modal" data-testid="others-modal">
      <header class="path break">oss://{{ bucketInfo.bucket }}/{{ objectInfo.path }}</header>
      <RestoreChecker :bucket-info="bucketInfo" :object-info="objectInfo" :file-type="fileType">
        <div class="content">
          <div class="alert-warning" data-testid="others-unsupported">{{ t('cannot.preview.this.file') }}</div>
          <div v-if="showAsCode" class="text-center">
            <button type="button" class="st-btn" data-testid="others-as-code" @click="openAsCode">
              {{ t('tryto.open.as.textfile') }}
            </button>
          </div>
        </div>
      </RestoreChecker>
    </div>
    <template #footer>
      <PreviewBar :object-info="objectInfo" :bucket-info="bucketInfo" />
      <span class="spacer" />
      <button type="button" class="st-btn" data-testid="others-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 others-modal（app/main/files/modals/preview/others-modal.js）：
// 无法预览提示；非压缩/二进制/office/pdf 扩展名时提供“尝试作为文本文件打开”（等价 showAsCodeBtn）。
// 文本预览由 CodeModal 承接（B3-12 完整实现，本批次提供最小只读版以避免打开无效弹窗）。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import RestoreChecker from './RestoreChecker.vue';
import PreviewBar from './PreviewBar.vue';
import { canPreviewAsCode } from '../../../services/preview.js';
import { sizeFormat } from '../../../services/file-size.js';
import { useUiStore } from '../../../stores/ui.js';

const props = defineProps({
  objectInfo: { type: Object, required: true },
  bucketInfo: { type: Object, required: true },
  fileType: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const ui = useUiStore();

const sizeText = computed(() => sizeFormat(props.objectInfo.size));
const showAsCode = computed(() => canPreviewAsCode(props.objectInfo.name));

function openAsCode() {
  const ext = (props.fileType && props.fileType.ext) || [];
  ui.open('preview-code', {
    objectInfo: props.objectInfo,
    bucketInfo: props.bucketInfo,
    fileType: { type: 'code', ext },
  });
  emit('close');
}

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
.text-center {
  text-align: center;
  margin-top: 10px;
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