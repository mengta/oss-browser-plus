<template>
  <div class="toast-host" data-testid="toast-host">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="toast-item"
      data-testid="toast-item"
      :class="'toast-' + item.type"
    >
      <span class="toast-kind" :data-testid="'toast-' + item.type" />
      {{ item.message }}
    </div>
  </div>
</template>

<script setup>
// 等价 Angular toast-list 指令：右上角列表、按 type 着色、store 内 ttl 到期自动移除。
import { useToastStore } from '../../stores/toast.js';

const toast = useToastStore();
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 60px;
  right: 16px;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
.toast-kind {
  display: none;
}
.toast-item {
  max-width: 360px;
  padding: 8px 12px;
  border-radius: 2px;
  font-size: 13px;
  color: var(--vsc-on-accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  word-break: break-all;
}
.toast-success {
  background: var(#2ea043);
}
.toast-info {
  background: var(--vsc-accent);
}
.toast-warning,
.toast-warn {
  background: var(#8a6d00);
}
.toast-danger,
.toast-error {
  background: var(#a1260d);
}
</style>