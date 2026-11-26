<template>
  <BaseModal :visible="true" title="CRC码" @close="onClose">
    <div class="crc-modal" data-testid="crc-modal">
      <h5>CRC64: <code data-testid="crc-value">{{ crc64 }}</code></h5>

      <div class="crc-doc">
        您可以下载后自行验证, 参考:
        <a href="javascript:void(0)" data-testid="crc-doc-link" @click="openDoc">通过crc64校验数据传输的完整性</a>
      </div>
    </div>
    <template #footer>
      <button type="button" class="st-btn" data-testid="crc-close" @click="onClose">关闭</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 crc-modal（app/main/files/modals/crc-modal.js + html）：
// 打开即读对象 HEAD 信息，展示 HashCrc64ecma；文档链接经 system.openExternal。
// 原版文案为硬编码中文，此处保持（未引入 i18n key）。
import { onMounted, ref } from 'vue';
import BaseModal from '../../base/BaseModal.vue';
import { ossClient } from '../../../services/oss-client.js';

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