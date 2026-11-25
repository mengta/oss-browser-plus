<template>
  <div class="toast-host" role="log" aria-live="polite">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="toast-host-item"
      :class="'toast-' + item.type"
      :data-testid="'toast-item'"
    >
      <span class="toast-msg">{{ item.message }}</span>
      <button class="toast-copy" type="button" @click="copy(item)">复制</button>
      <button class="toast-close" type="button" @click="toast.remove(item.id)">×</button>
    </div>
  </div>
</template>

<script setup>
import { useToastStore } from '../../stores/toast.js';

const toast = useToastStore();

async function copy(item) {
  await toast.copy(item);
}
</script>

<style scoped>
.toast-host {
  position: fixed;
  bottom: 0;
  left: 10px;
  right: 70%;
  z-index: 10000;
}
.toast-host-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
}
.toast-msg {
  flex: 1;
  word-break: break-all;
}
.toast-danger {
  border-left: 3px solid #d9534f;
}
.toast-success {
  border-left: 3px solid #5cb85c;
}
.toast-warning {
  border-left: 3px solid #f0ad4e;
}
.toast-info {
  border-left: 3px solid #5bc0de;
}
.toast-copy,
.toast-close {
  background: none;
  border: none;
  padding: 0 2px;
  cursor: pointer;
  color: #666;
}
</style>