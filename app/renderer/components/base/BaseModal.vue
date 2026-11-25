<template>
  <div v-if="visible" class="base-modal-mask" data-testid="base-modal-mask" @click.self="onMask">
    <div
      class="base-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      data-testid="base-modal"
    >
      <header class="base-modal-header">
        <h3 class="base-modal-title">{{ title }}</h3>
        <button class="base-modal-close" type="button" data-testid="base-modal-close" @click="onClose">
          ×
        </button>
      </header>
      <div class="base-modal-body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="base-modal-footer">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: true },
  title: { type: String, default: '' },
  maskClosable: { type: Boolean, default: true },
  escClosable: { type: Boolean, default: true },
  result: { type: null, default: null },
});

const emit = defineEmits(['close']);

function close(value) {
  emit('close', value === undefined ? props.result : value);
}

function onMask() {
  if (props.maskClosable) {
    close();
  }
}

function onClose() {
  close();
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.escClosable) {
    close();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.base-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
}
.base-modal {
  background: #fff;
  border-radius: 6px;
  min-width: 360px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
.base-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
}
.base-modal-title {
  margin: 0;
  font-size: 14px;
}
.base-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
}
.base-modal-body {
  padding: 14px;
  overflow: auto;
}
.base-modal-footer {
  padding: 10px 14px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>