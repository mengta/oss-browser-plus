<template>
  <button type="button" class="btn btn-default" :disabled="disabled" @click="pick">
    <slot />
  </button>
</template>

<script setup>
// 等价 Dialog.showUploadDialog 的路径选择部分（app/components/services/dialog.s.js:16-32）：
// isFolder → openDirectory+multiSelections；Mac 覆盖为 openFile+openDirectory+multiSelections。
// 仅负责选择并 emit 路径数组，入队由调用方（transfer store createUploadJobs）完成。
import { useBootstrapStore } from '../../stores/bootstrap.js';

const props = defineProps({
  isFolder: { type: Boolean, default: false },
  title: { type: String, default: 'Upload' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['picked']);

const bootstrapStore = useBootstrapStore();

function systemApi() {
  return typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
}

async function pick() {
  const api = systemApi();
  if (!api || typeof api.showOpenDialog !== 'function') return;
  const isMac = (bootstrapStore.snapshot && bootstrapStore.snapshot.platform) === 'darwin';
  const properties = isMac
    ? ['openFile', 'openDirectory', 'multiSelections']
    : props.isFolder
      ? ['openDirectory', 'multiSelections']
      : ['openFile', 'multiSelections'];
  try {
    const res = await api.showOpenDialog({ title: props.title, properties });
    const data = res && res.ok ? res.data : null;
    if (data && !data.canceled && data.filePaths && data.filePaths.length > 0) {
      emit('picked', data.filePaths);
    }
  } catch (err) {
    /* 取消/失败静默 */
  }
}

defineExpose({ pick });
</script>

<style scoped>
.btn {
  padding: 3px 10px;
}
</style>