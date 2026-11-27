<template>
  <div class="ak-histories-panel" data-testid="ak-histories-panel">
    <input v-model="keyword" type="text" class="akh-search" :placeholder="t('search')" data-testid="akh-search" />
    <div class="akh-table">
      <div class="akh-head" aria-hidden="true">
        <span class="akh-ellipsis">{{ t('auth.description') }}</span>
        <span class="akh-ellipsis">{{ t('ak') }}</span>
        <span class="akh-ellipsis">{{ t('auth.secret') }}</span>
        <span class="akh-ellipsis">{{ t('region') }}</span>
        <span class="akh-ellipsis">{{ t('auth.presetOssPath') }}</span>
        <span class="akh-ellipsis">{{ t('actions') }}</span>
      </div>
      <ul class="akh-list">
        <li v-for="h in filtered" :key="h.id" class="akh-item" data-testid="akh-item">
          <HintTooltip class="akh-cell" :text="descText(h)" :max-width="260">
            <span class="akh-ellipsis akh-desc" data-testid="akh-desc">{{ descText(h) }}</span>
          </HintTooltip>
          <HintTooltip class="akh-cell" :text="String(h.id || '')" :max-width="320">
            <span class="akh-ellipsis akh-id">{{ h.id }}</span>
          </HintTooltip>
          <HintTooltip class="akh-cell" :text="secretText(h)" :max-width="320">
            <code class="akh-ellipsis akh-secret">{{ secretText(h) }}</code>
          </HintTooltip>
          <HintTooltip class="akh-cell" :text="regionText(h)" :max-width="220">
            <span class="akh-ellipsis akh-region">{{ regionText(h) }}</span>
          </HintTooltip>
          <HintTooltip class="akh-cell" :text="pathText(h)" :max-width="360">
            <span class="akh-ellipsis akh-path" data-testid="akh-osspath">{{ pathText(h) }}</span>
          </HintTooltip>
          <span class="akh-ops">
            <button type="button" class="akh-btn" data-testid="akh-toggle" @click="toggleSecret(h)">
              {{ showSecrets[h.id] ? t('hide') : t('show') }}
            </button>
            <button type="button" class="akh-btn" data-testid="akh-use" @click="use(h)">{{ t('use') }}</button>
            <button type="button" class="akh-btn" data-testid="akh-remove" @click="remove(h)">{{ t('delete') }}</button>
          </span>
        </li>
      </ul>
    </div>
    <div class="akh-actions">
      <button type="button" class="akh-btn" data-testid="akh-cleanall" @click="cleanAll">{{ t('clearAll') }}</button>
    </div>

    <BaseModal v-if="pending" :visible="true" :title="pending.title" :result="false" @close="pending = null">
      <p class="akh-confirm-text">{{ pending.message }}</p>
      <template #footer>
        <button type="button" class="akh-btn" data-testid="akh-confirm-cancel" @click="pending = null">
          {{ t('cancel') }}
        </button>
        <button type="button" class="akh-btn" data-testid="akh-confirm-ok" @click="confirmPending">
          {{ t('ok') }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../../stores/auth.js';
import { useToastStore } from '../../../stores/toast.js';
import { maskSecret } from '../../../services/formatters.js';
import BaseModal from '../../base/BaseModal.vue';
import HintTooltip from '../../base/HintTooltip.vue';

const emit = defineEmits(['use', 'close']);
const { t } = useI18n();
const auth = useAuthStore();
const toast = useToastStore();

const keyword = ref('');
const showSecrets = ref({});
const pending = ref(null);

const list = computed(() => auth.listHistories());
const filtered = computed(() => {
  const key = String(keyword.value || '').trim().toLowerCase();
  if (!key) {
    return list.value;
  }
  return list.value.filter((item) => String(item.id || '').toLowerCase().indexOf(key) >= 0);
});

function toggleSecret(item) {
  showSecrets.value = Object.assign({}, showSecrets.value, { [item.id]: !showSecrets.value[item.id] });
}

function regionText(item) {
  if (!item.region) {
    return '-';
  }
  const key = 'region.' + item.region;
  const text = t(key);
  return text === key ? item.region : text;
}

function descText(item) {
  const desc = String(item.desc || '').trim();
  return desc || '-';
}

function secretText(item) {
  return showSecrets.value[item.id] ? String(item.secret || '') : maskSecret(item.secret);
}

function pathText(item) {
  const osspath = String(item.osspath || '').trim();
  return osspath || '-';
}

function use(item) {
  emit('use', item);
  emit('close');
}

function remove(item) {
  pending.value = {
    type: 'remove',
    item,
    title: t('auth.removeAK.title'),
    message: t('auth.removeAK.message', { id: item.id }),
  };
}

function cleanAll() {
  pending.value = {
    type: 'cleanAll',
    title: t('auth.clearAKHistories.title'),
    message: t('auth.clearAKHistories.message'),
  };
}

function confirmPending() {
  const task = pending.value;
  if (!task) {
    return;
  }
  if (task.type === 'remove') {
    auth.removeHistory(task.item.id);
  } else {
    auth.cleanHistories();
    toast.push(t('auth.clearAKHistories.successMessage'), 'success');
  }
  pending.value = null;
}
</script>

<style scoped>
.ak-histories-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.akh-search {
  padding: 6px 8px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-input);
  color: var(--vsc-fg);
  font-size: 12px;
}
.akh-search::placeholder {
  color: var(--vsc-fg-dim);
}
.akh-search:focus {
  border-color: var(--vsc-accent);
  outline: 1px solid var(--vsc-accent);
}
.akh-table {
  max-height: 340px;
  overflow: auto;
}
.akh-head,
.akh-item {
  display: grid;
  grid-template-columns: 100px 124px 118px 84px 170px 168px;
  gap: 8px;
  align-items: center;
  min-width: 764px;
}
.akh-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 8px;
  border-bottom: 1px solid var(--vsc-border);
  background: var(--vsc-bg-elevated);
  color: var(--vsc-fg-muted);
  font-size: 11px;
}
.akh-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.akh-item {
  padding: 6px 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
  font-size: 12px;
}
.akh-item:hover {
  background: var(--vsc-bg-hover);
}
.akh-cell {
  display: inline-flex;
  width: 100%;
  min-width: 0;
}
.akh-ellipsis {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.akh-desc {
  color: var(--vsc-fg);
}
.akh-id {
  font-family: monospace;
}
.akh-secret {
  box-sizing: border-box;
  padding: 1px 6px;
  border: 1px solid var(--vsc-border-weak);
  border-radius: 2px;
  background: var(--vsc-bg-input);
  color: var(--vsc-fg);
  font-family: var(--vsc-mono);
  font-size: 12px;
}
.akh-region {
  color: var(--vsc-fg-muted);
}
.akh-path {
  color: var(--vsc-fg-muted);
}
.akh-ops {
  display: flex;
  align-items: center;
  gap: 4px;
}
.akh-btn {
  padding: 2px 6px;
  border: 1px solid var(--vsc-border-weak);
  background: var(--vsc-bg-elevated);
  color: var(--vsc-fg);
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}
.akh-btn:hover {
  background: var(--vsc-bg-hover);
}
.akh-actions {
  display: flex;
  justify-content: flex-end;
}
</style>