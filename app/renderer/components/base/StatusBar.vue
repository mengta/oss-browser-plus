<template>
  <footer class="status-bar" data-testid="status-bar">
    <div class="sb-left">

      <template v-if="loggedIn">
        <span class="sb-item" data-testid="status-path">{{ pathText }}</span>
        <span class="sb-item" data-testid="status-count">{{ filesCount }}</span>
        <span v-if="selectedCount > 0" class="sb-item" data-testid="status-selected">{{ selectedCount }}</span>
      </template>
    </div>
    <div class="sb-right">
      <span v-if="transferCount > 0" class="sb-item" data-testid="status-transfer">⇅ {{ transferCount }}</span>
      <span v-if="region" class="sb-item" data-testid="status-region">{{ region }}</span>
      <span class="sb-item" data-testid="status-locale">{{ localeText }}</span>
      <span class="sb-item" data-testid="status-version">v{{ version }}</span>
    </div>
  </footer>
</template>

<script setup>
// VS Code 风格状态栏：左侧路径/对象数/选中数，右侧传输/区域/语言/版本。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { useBootstrapStore } from '../../stores/bootstrap.js';
import { useFilesStore } from '../../stores/files.js';
import { useTransferStore } from '../../stores/transfer.js';

const { locale } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const bootstrapStore = useBootstrapStore();
const filesStore = useFilesStore();
const transferStore = useTransferStore();

const loggedIn = computed(() => authStore.isLoggedIn);
const version = computed(() => (bootstrapStore.snapshot && bootstrapStore.snapshot.appVersion) || '');
const region = computed(() => {
  if (route.name === 'login') return '';
  return filesStore.region || '';
});
const pathText = computed(() => {
  if (route.name === 'login') return '';
  if (filesStore.isBucketList) return 'oss://';
  return 'oss://' + (filesStore.bucket || '') + '/' + (filesStore.prefix || '');
});
const filesCount = computed(() => (filesStore.isBucketList ? filesStore.buckets.length : filesStore.items.length));
const selectedCount = computed(() =>
  filesStore.isBucketList ? (filesStore.bucketSelected ? 1 : 0) : filesStore.selectedList.length
);
const transferCount = computed(() => {
  const list = [...(transferStore.uploads || []), ...(transferStore.downloads || [])];
  return list.filter((task) => task.status === 'running' || task.status === 'waiting').length;
});
const localeText = computed(() => String(locale.value || 'zh-CN'));
</script>

<style scoped>
.status-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--vsc-statusbar-h, 22px);
  z-index: 1030;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  background: var(--vsc-accent, #007acc);
  color: var(--vsc-on-accent, #fff);
  font-size: 12px;
  user-select: none;
}
.sb-left,
.sb-right {
  display: flex;
  align-items: center;
}
.sb-item {
  padding: 0 8px;
  line-height: 22px;
  white-space: nowrap;
}
.sb-item:hover {
  background: rgba(255, 255, 255, 0.14);
}

</style>