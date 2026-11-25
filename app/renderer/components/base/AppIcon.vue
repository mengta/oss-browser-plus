<template>
  <svg
    class="app-icon"
    :class="iconClass"
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="name"
    focusable="false"
  >
    <path :d="path" fill="currentColor" />
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { getIconPath } from '../../icons/registry.js';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
  iconClass: { type: [String, Array, Object], default: '' },
});

const path = computed(() => getIconPath(props.name));

const sizePx = computed(() => {
  const value = Number(props.size);
  return Number.isFinite(value) && value > 0 ? value : 16;
});
</script>

<style scoped>
.app-icon {
  display: inline-block;
  vertical-align: middle;
  fill: currentColor;
  flex-shrink: 0;
}
</style>