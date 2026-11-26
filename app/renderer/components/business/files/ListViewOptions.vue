<template>
  <div class="list-view-options" data-testid="list-view-options">
    <button
      type="button"
      class="btn-icon"
      data-testid="view-list"
      :class="{ active: filesStore.viewMode === 'list' }"
      :title="t('common.listView') || 'List view'"
      @click="filesStore.setView('list')"
    >
      <AppIcon name="square" />
    </button>
    <button
      type="button"
      class="btn-icon"
      data-testid="view-blocks"
      :class="{ active: filesStore.viewMode === 'blocks' }"
      :title="t('common.blockView') || 'Block view'"
      @click="filesStore.setView('blocks')"
    >
      <AppIcon name="file" />
    </button>
  </div>
</template>

<script setup>
// 等价 list-view-options（app/main/files/_/list-view-options.js）：
// 列表/块视图切换，持久化 is-list-view localStorage（true/false）。
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import { useFilesStore } from '../../../stores/files.js';

const { t } = useI18n();
const filesStore = useFilesStore();
</script>

<style scoped>
.list-view-options {
  display: inline-flex;
  gap: 2px;
}
.btn-icon {
  border: none;
  background: none;
  padding: 4px 6px;
  cursor: pointer;
  line-height: 1;
  color: var(--vsc-fg-muted);
}
.btn-icon.active {
  color: var(--vsc-link);
}
</style>