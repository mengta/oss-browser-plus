<template>
  <BaseModal :visible="true" :title="t('bookmarks.title')" :mask-closable="false" @close="onCancel">
    <div class="fav-body" data-testid="fav-modal">
      <div v-if="favorites.items.length === 0" class="fav-empty" data-testid="fav-empty">{{ t('no.data') }}</div>

      <table v-else class="fav-table" data-testid="fav-table">
        <tr>
          <th>URL</th>
          <th>{{ t('time') }}</th>
          <th>{{ t('actions') }}</th>
        </tr>
        <tr v-for="item in favorites.items" :key="item.url" data-testid="fav-row">
          <td class="break">
            <a href="javascript:;" data-testid="fav-url" @click="goTo(item.url)">{{ item.url }}</a>
          </td>
          <td>{{ formatDateTime(item.time) }}</td>
          <td>
            <a href="javascript:;" class="fav-remove" data-testid="fav-remove" @click="removeFav(item)">{{ t('delete') }}</a>
          </td>
        </tr>
      </table>
    </div>

    <template #footer>
      <button type="button" class="fav-btn" data-testid="fav-close" @click="onCancel">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { useFavoritesStore } from '../../../stores/favorites.js';
import { useToastStore } from '../../../stores/toast.js';
import { formatDateTime } from '../../../services/formatters.js';

// 等价 favListCtrl：列表/跳转（goToOssAddress）/删除（bookmarks.delete.success）
const emit = defineEmits(['close', 'goTo']);
const { t } = useI18n();
const favorites = useFavoritesStore();
const toast = useToastStore();

favorites.warm();

function goTo(url) {
  emit('goTo', url);
  emit('close');
}

function removeFav(item) {
  favorites.remove(item.url);
  toast.push(t('bookmarks.delete.success'), 'warning', 1000);
}

function onCancel() {
  emit('close');
}
</script>

<style scoped>
.fav-body {
  min-width: 560px;
}
.fav-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
.fav-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.fav-table th,
.fav-table td {
  border: 1px solid var(--vsc-border-weak);
  padding: 5px 8px;
  text-align: left;
}
.break {
  word-break: break-all;
}
.fav-remove {
  color: #a1260d;
}
.fav-btn {
  padding: 4px 14px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
</style>