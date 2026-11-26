<template>
  <div class="login-tabs" role="tablist" :aria-label="t('login.mode')">
    <button
      type="button"
      class="login-tab"
      :class="{ active: modelValue === 'ak' }"
      role="tab"
      :aria-selected="modelValue === 'ak'"
      data-testid="login-tab-ak"
      @click="$emit('update:modelValue', 'ak')"
    >
      <span class="lt-title"><AppIcon name="user" class="lt-icon" />{{ t('auth.akLogin') }}</span>
      <span class="lt-desc">{{ t('login.mode.akDesc') }}</span>
    </button>
    <button
      type="button"
      class="login-tab"
      :class="{ active: modelValue === 'token' }"
      role="tab"
      :aria-selected="modelValue === 'token'"
      data-testid="login-tab-token"
      @click="$emit('update:modelValue', 'token')"
    >
      <span class="lt-title"><AppIcon name="user-secret" class="lt-icon" />{{ t('auth.tokenLogin') }}</span>
      <span class="lt-desc">{{ t('login.mode.tokenDesc') }}</span>
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';

defineProps({
  modelValue: { type: String, default: 'ak' },
});
defineEmits(['update:modelValue']);

const { t } = useI18n();
</script>

<style scoped>
.login-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.login-tab {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 12px;
  border: 1px solid var(--vsc-border);
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
  text-align: left;
}
.login-tab:hover {
  background: var(--vsc-bg-hover);
}
.login-tab.active {
  border-color: var(--vsc-accent);
  background: rgba(0, 122, 204, 0.2);
}
.login-tab.active .lt-desc {
  color: var(--vsc-fg);
}
.lt-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vsc-fg);
}
.lt-icon {
  width: 13px;
  height: 13px;
  color: var(--vsc-accent);
}
.lt-desc {
  font-size: 11px;
  color: var(--vsc-fg-muted);
}
</style>