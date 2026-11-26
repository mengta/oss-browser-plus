<template>
  <div class="list-view-options" data-testid="list-view-options">
    <button
      type="button"
      class="btn-icon"
      data-testid="view-list"
      :class="{ active: filesStore.viewMode === 'list' }"
      :title="t('common.listView') || 'List view'"
      :aria-pressed="filesStore.viewMode === 'list'"
      @click="filesStore.setView('list')"
    >
      <AppIcon name="list" />
    </button>
    <button
      type="button"
      class="btn-icon"
      data-testid="view-blocks"
      :class="{ active: filesStore.viewMode === 'blocks' }"
      :title="t('common.blockView') || 'Block view'"
      :aria-pressed="filesStore.viewMode === 'blocks'"
      @click="filesStore.setView('blocks')"
    >
      <AppIcon name="grid" />
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: none;
  padding: 0;
  cursor: pointer;
  line-height: 1;
  color: var(--vsc-fg-muted);
}
.btn-icon:hover {
  background: var(--vsc-bg-hover);
  color: var(--vsc-fg);
}
.btn-icon.active {
  color: var(--vsc-accent);
  background: rgba(0, 122, 204, 0.16);
  border-color: rgba(0, 122, 204, 0.45);
}
</style>