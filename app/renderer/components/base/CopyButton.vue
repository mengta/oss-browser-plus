<template>
  <button
    class="copy-button"
    type="button"
    :title="title"
    :disabled="disabled || !text"
    data-testid="copy-button"
    @click="copy"
  >
    <slot>复制</slot>
  </button>
</template>

<script setup>
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  text: { type: String, default: '' },
  title: { type: String, default: '复制' },
  successKey: { type: String, default: 'copy.successfully' },
  disabled: { type: Boolean, default: false },
});

const toast = useToastStore();

async function copy() {
  const res = await toast.copy({ message: props.text });
  if (res && res.ok === true) {
    toast.push(props.successKey, 'success', 2000);
  }
}
</script>

<style scoped>
.copy-button {
  background: none;
  border: none;
  padding: 0 4px;
  cursor: pointer;
  color: var(--vsc-accent);
  font-size: 12px;
}
.copy-button[disabled] {
  color: var(--vsc-fg-muted);
  cursor: not-allowed;
}
</style>