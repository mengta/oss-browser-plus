<template>
  <div class="vue-app-shell">
    <div v-if="loading" class="vue-boot-loading" role="status" aria-live="polite">
      <span class="vue-boot-spinner"></span>
    </div>
    <router-view v-else />
    <ModalHost />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { init } from './bootstrap.js';
import ModalHost from './components/base/ModalHost.vue';

const loading = ref(true);
const bootError = ref(null);

onMounted(async () => {
  try {
    await init();
  } catch (err) {
    bootError.value = err;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>

.vue-boot-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
}

.vue-boot-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #ccc;
  border-top-color: #666;
  border-radius: 50%;
  animation: vue-boot-spin 0.8s linear infinite;
}

@keyframes vue-boot-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>