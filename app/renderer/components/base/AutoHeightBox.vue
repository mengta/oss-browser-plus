<template>
  <div class="auto-height-box" ref="el" data-testid="auto-height-box">
    <slot />
  </div>
</template>

<script setup>
// 等价 auto-height 指令（app/components/directives/auto-height.js）：
// 高度 = window.innerHeight + offset（files 页 auto-height="-130"）；resize 300ms 防抖重算。
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  offset: { type: Number, default: -130 },
});

const el = ref(null);
let timer = null;

function apply() {
  if (!el.value || typeof window === 'undefined') return;
  el.value.style.overflow = 'auto';
  el.value.style.position = 'relative';
  el.value.style.height = window.innerHeight + props.offset + 'px';
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(apply, 300);
}

onMounted(() => {
  apply();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', schedule);
  }
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', schedule);
  }
});

defineExpose({ apply });
</script>

<style scoped>
.auto-height-box {
  overflow: auto;
  position: relative;
}
</style>