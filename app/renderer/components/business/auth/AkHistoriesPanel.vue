<template>
  <div class="ak-histories-panel" data-testid="ak-histories-panel">
    <input v-model="keyword" type="text" class="akh-search" :placeholder="t('search')" data-testid="akh-search" />
    <ul class="akh-list">
      <li v-for="h in filtered" :key="h.id" class="akh-item" data-testid="akh-item">
        <span class="akh-id">{{ h.id }}</span>
        <code class="akh-secret">{{ showSecrets[h.id] ? h.secret : maskSecret(h.secret) }}</code>
        <span class="akh-region">{{ regionText(h) }}</span>
        <span v-if="h.requestpaystatus === 'YES'" class="akh-tag" data-testid="akh-requestpay">{{ t('requestPay') }}</span>
        <button type="button" class="akh-btn" data-testid="akh-toggle" @click="toggleSecret(h)">
          {{ showSecrets[h.id] ? t('hide') : t('show') }}
        </button>
        <button type="button" class="akh-btn" data-testid="akh-use" @click="use(h)">{{ t('use') }}</button>
        <button type="button" class="akh-btn" data-testid="akh-remove" @click="remove(h)">{{ t('delete') }}</button>
      </li>
    </ul>
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
.akh-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow: auto;
}
.akh-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
  font-size: 12px;
}
.akh-id {
  min-width: 160px;
  font-family: monospace;
}
.akh-secret {
  min-width: 140px;
  padding: 1px 6px;
  border: 1px solid var(--vsc-border-weak);
  border-radius: 2px;
  background: var(--vsc-bg-input);
  color: var(--vsc-fg);
  font-family: var(--vsc-mono);
  font-size: 12px;
}
.akh-region {
  min-width: 90px;
  color: var(--vsc-fg-muted);
}
.akh-tag {
  padding: 1px 6px;
  border: 1px solid var(--vsc-warning-solid);
  border-radius: 2px;
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
  font-size: 11px;
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