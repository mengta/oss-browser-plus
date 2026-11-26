<template>
  <div class="preview-bar" data-testid="preview-bar">
    <button type="button" class="st-btn" data-testid="preview-download" @click="onDownload">
      {{ t('download') }}
    </button>
    <button v-if="!isSts" type="button" class="st-btn" data-testid="preview-address" @click="onAddress">
      {{ t('getAddress') }}
    </button>
    <button type="button" class="st-btn" data-testid="preview-http-headers" @click="onHttpHeaders">
      {{ t('http.headers') }}
    </button>
    <button type="button" class="st-btn" data-testid="preview-acl" @click="onAcl">
      {{ t('acl') }}
    </button>
  </div>
</template>

<script setup>
// 等价 preview-bar.html：下载 / 获取地址（STS 隐藏）/ HTTP头 / ACL。
// 下载复用 B3-07 链路（选择目录 → createDownloadJobs → 传输中心）。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { pickDownloadFolder } from '../../../services/file-actions.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';

const props = defineProps({
  objectInfo: { type: Object, required: true },
  bucketInfo: { type: Object, required: true },
});

const { t } = useI18n();
const authStore = useAuthStore();
const toast = useToastStore();
const ui = useUiStore();

const isSts = computed(() => {
  const id = (authStore.info && authStore.info.id) || '';
  return id.indexOf('STS.') === 0;
});

async function onDownload() {
  toast.push(t('download.addtolist.on'), 'info', 1000);
  const res = await pickDownloadFolder([props.objectInfo], props.bucketInfo);
  if (res && res.ok) {
    toast.push(t('download.addtolist.success'), 'success', 2000);
  }
}

function onAddress() {
  if (isSts.value) return;
  ui.open('get-address', { item: props.objectInfo, currentInfo: props.bucketInfo });
}

function onHttpHeaders() {
  ui.open('update-http-headers', { item: props.objectInfo, currentInfo: props.bucketInfo });
}

function onAcl() {
  ui.open('update-acl', { item: props.objectInfo, currentInfo: props.bucketInfo });
}
</script>

<style scoped>
.preview-bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.st-btn {
  padding: 3px 10px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
</style>