<template>
  <div ref="el" class="long-scroll-list" data-testid="long-scroll-list">
    <slot />
  </div>
</template>

<script setup>
// 等价 long-scroll-list 指令（app/components/directives/long-scroll-list.js）：
// 自滚动容器，接近底部（scrollTop + h > scrollHeight - triggerSize）时
// 经 200ms 防抖触发 loadMore。原版虚拟化逻辑未启用，此处同语义不虚拟化。
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  triggerSize: { type: Number, default: 20 },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['loadMore']);

const el = ref(null);
let timer = null;

function onScroll() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (props.disabled) return;
    const node = el.value;
    if (!node) return;
    const size = props.triggerSize || 20;
    if (node.scrollTop + node.clientHeight > node.scrollHeight - size) {
      emit('loadMore');
    }
  }, 200);
}

onMounted(() => {
  if (el.value) {
    el.value.addEventListener('scroll', onScroll);
  }
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  if (el.value) {
    el.value.removeEventListener('scroll', onScroll);
  }
});

defineExpose({ root: el });
</script>

<style scoped>
.long-scroll-list {
  height: 100%;
  overflow: auto;
  position: relative;
}
</style>