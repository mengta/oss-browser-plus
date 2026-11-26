<template>
  <BaseModal :visible="true" :title="t('crc.title')" @close="onClose">
    <div class="crc-modal" data-testid="crc-modal">
      <h5>CRC64: <code data-testid="crc-value">{{ crc64 }}</code></h5>

      <div class="crc-doc">
        {{ t('crc.desc') }}
        <a href="javascript:void(0)" data-testid="crc-doc-link" @click="openDoc">{{ t('crc.link') }}</a>
      </div>
    </div>
    <template #footer>
      <button type="button" class="st-btn" data-testid="crc-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { ossClient } from '../../../services/oss-client.js';

const { t } = useI18n();

const props = defineProps({
  item: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const crc64 = ref('');

function openDoc() {
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (system && typeof system.openExternal === 'function') {
    system.openExternal('https://help.aliyun.com/document_detail/43394.html').catch(() => {});
  }
}

onMounted(() => {
  const info = props.currentInfo || {};
  ossClient
    .getFileInfo(info.region, info.bucket, props.item.path)
    .then((data) => {
      crc64.value = (data && data.HashCrc64ecma) || '';
    })
    .catch(() => {
      crc64.value = '';
    });
});

function onClose() {
  emit('close');
}
</script>

<style scoped>
.crc-modal {
  min-width: 420px;
}
.crc-doc {
  padding: 6px 10px;
  background: var(--vsc-success-bg);
  border-radius: 2px;
  font-size: 12px;
  color: var(--vsc-success);
}
.crc-doc a {
  color: var(--vsc-link);
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