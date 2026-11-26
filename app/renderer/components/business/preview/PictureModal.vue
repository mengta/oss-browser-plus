<template>
  <BaseModal :visible="true" :title="t('preview') + ' (' + sizeText + ')'" :mask-closable="false" @close="onClose">
    <div class="preview-modal" data-testid="picture-modal">
      <header class="path break">oss://{{ bucketInfo.bucket }}/{{ objectInfo.path }}</header>
      <RestoreChecker
        :bucket-info="bucketInfo"
        :object-info="objectInfo"
        :file-type="fileType"
        @ready="loadImage"
      >
        <div class="content text-center">
          <div v-if="!src" class="loading">{{ t('loading') }}</div>
          <img v-else :src="src" :alt="t('cannot.preview')" class="picture" data-testid="picture-image" />
        </div>
      </RestoreChecker>
    </div>
    <template #footer>
      <PreviewBar :object-info="objectInfo" :bucket-info="bucketInfo" />
      <span class="spacer" />
      <button type="button" class="st-btn" data-testid="picture-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 picture-modal（app/main/files/modals/preview/picture-modal.js）：
// RestoreChecker 通过后加载图片；STS 账号走 getImageBase64Url（data URL），
// 其他账号走 signatureUrl2；size ≥5MB 时使用 image/quality,q_10 压缩图（原版语义）。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import RestoreChecker from './RestoreChecker.vue';
import PreviewBar from './PreviewBar.vue';
import { ossClient } from '../../../services/oss-client.js';
import { base64FromBytes } from '../../../services/base64.js';
import { sizeFormat } from '../../../services/file-size.js';
import { useAuthStore } from '../../../stores/auth.js';

const MAX_SIZE = 5 * 1024 * 1024;

const props = defineProps({
  objectInfo: { type: Object, required: true },
  bucketInfo: { type: Object, required: true },
  fileType: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const authStore = useAuthStore();
const src = ref('');

const sizeText = computed(() => sizeFormat(props.objectInfo.size));
const isSts = computed(() => {
  const id = (authStore.info && authStore.info.id) || '';
  return id.indexOf('STS.') === 0;
});

function loadImage() {
  const info = props.bucketInfo || {};
  const obj = props.objectInfo || {};
  if (isSts.value) {
    ossClient
      .getImageBase64Url(info.region, info.bucket, obj.path)
      .then((data) => {
        const contentType = (data && data.ContentType) || '';
        if (contentType.indexOf('image/') === 0) {
          src.value = 'data:' + contentType + ';base64,' + base64FromBytes(data.Body);
        }
      })
      .catch(() => {});
    return;
  }
  const compressed = obj.size >= MAX_SIZE;
  const request = compressed
    ? ossClient.signatureUrl2(info.region, info.bucket, obj.path, 3600, 'image/quality,q_10')
    : ossClient.signatureUrl2(info.region, info.bucket, obj.path);
  request
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
.picture {
  max-width: 100%;
  max-height: 60vh;
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