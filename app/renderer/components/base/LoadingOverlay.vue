<template>
  <div v-if="visible" class="loading-overlay" :class="overlayClass" data-testid="loading-overlay">
    <div class="loadEffect">
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: true },
  overlayClass: { type: [String, Array, Object], default: '' },
});
</script>

<style scoped>
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.loadEffect {
  width: 40px;
  height: 40px;
  position: relative;
  transform: rotate(45deg);
}
.loadEffect span {
  display: block;
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(#2ea043);
  border-radius: 2px;
  animation: loadEffect-square 1.2s infinite ease-in-out;
}
.loadEffect span:nth-child(1) { top: 0; left: 0; }
.loadEffect span:nth-child(2) { top: 0; right: 0; }
.loadEffect span:nth-child(3) { bottom: 0; right: 0; }
.loadEffect span:nth-child(4) { bottom: 0; left: 0; }
.loadEffect span:nth-child(5) { top: 0; left: 0; }
.loadEffect span:nth-child(6) { top: 0; right: 0; }
.loadEffect span:nth-child(7) { bottom: 0; right: 0; }
.loadEffect span:nth-child(8) { bottom: 0; left: 0; }
@keyframes loadEffect-square {
  0% { transform: scale(0.6); opacity: 0.6; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.6); opacity: 0.6; }
}
</style>