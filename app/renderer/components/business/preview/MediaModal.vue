<template>
  <BaseModal :visible="true" :title="t('preview') + ' (' + sizeText + ')'" :mask-closable="false" @close="onClose">
    <div class="preview-modal" data-testid="media-modal">
      <header class="path break">oss://{{ bucketInfo.bucket }}/{{ objectInfo.path }}</header>
      <RestoreChecker :bucket-info="bucketInfo" :object-info="objectInfo" :file-type="fileType" @ready="genURL">
        <div class="content text-center">
          <div v-if="!src" class="loading">{{ t('loading') }}</div>
          <template v-else>
            <audio v-if="isAudio" :src="src" controls preload="none" data-testid="media-audio" />
            <FlvPlayer v-else-if="isFlv" :src="src" />
            <video
              v-else
              :src="src"
              controls
              preload="none"
              class="media-video"
              data-testid="media-video"
            />
          </template>
        </div>
      </RestoreChecker>
    </div>
    <template #footer>
      <PreviewBar :object-info="objectInfo" :bucket-info="bucketInfo" />
      <span class="spacer" />
      <button type="button" class="st-btn" data-testid="media-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 media-modal（app/main/files/modals/preview/media-modal.js）：
// audio 直接播放；video 使用 signatureUrl2(3600)；flv 由 B3-12 FlvPlayer 承接（本批次先给等价不可预览提示）。
// 原版 jQuery 高度自适应改为 CSS（max-height 70vh），避免引入 DOM 尺寸计算。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import RestoreChecker from './RestoreChecker.vue';
import PreviewBar from './PreviewBar.vue';
import FlvPlayer from '../../base/FlvPlayer.vue';
import { ossClient } from '../../../services/oss-client.js';
import { sizeFormat } from '../../../services/file-size.js';

const props = defineProps({
  objectInfo: { type: Object, required: true },
  bucketInfo: { type: Object, required: true },
  fileType: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const src = ref('');

const sizeText = computed(() => sizeFormat(props.objectInfo.size));
const isAudio = computed(() => props.fileType && props.fileType.type === 'audio');
const isFlv = computed(() => {
  const ext = props.fileType && props.fileType.ext;
  return Array.isArray(ext) && ext[0] === 'flv';
});

function genURL() {
  const info = props.bucketInfo || {};
  ossClient
    .signatureUrl2(info.region, info.bucket, props.objectInfo.path, 3600)
    .then((url) => {
      src.value = url;
    })
    .catch(() => {});
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.preview-modal {
  min-width: 640px;
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
  padding: 10px;
}
.media-video {
  max-width: 100%;
  max-height: 70vh;
  min-width: 200px;
}
.unsupported {
  padding: 20px;
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
}
.loading {
  color: var(--vsc-fg-muted);
  padding: 20px;
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