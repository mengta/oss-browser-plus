<template>
  <div class="empty-state" data-testid="empty-state">
    <AppIcon :name="icon" :size="48" icon-class="empty-state-icon" />
    <p class="empty-state-text">{{ text }}</p>
    <slot />
  </div>
</template>

<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  icon: { type: String, default: 'inbox' },
  text: { type: String, default: '' },
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--vsc-fg-muted);
  text-align: center;
}
.empty-state-icon {
  opacity: 0.5;
}
.empty-state-text {
  margin: 0;
  font-size: 13px;
}
</style>