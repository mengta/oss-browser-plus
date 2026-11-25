<template>
  <span class="timer-text" data-testid="timer-text">{{ display }}</span>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatLeftTime } from '../../services/formatters.js';

const props = defineProps({
  endTime: { type: Number, required: true },
  interval: { type: Number, default: 1000 },
});

const now = ref(Date.now());
let timer = null;

const display = computed(() => formatLeftTime(props.endTime - now.value));

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

onMounted(() => {
  if (props.endTime - now.value <= 0) {
    return;
  }
  timer = setInterval(() => {
    now.value = Date.now();
    if (props.endTime - now.value <= 0) {
      stop();
    }
  }, props.interval);
});

onUnmounted(stop);

defineExpose({ stop });
</script>

<style scoped>
.timer-text {
  font-variant-numeric: tabular-nums;
}
</style>