<template>
  <div ref="el" class="bottom-loader" data-testid="bottom-loader">
    <slot>
      <span v-if="loading" class="loading-more">{{ text }}</span>
    </slot>
  </div>
</template>

<script setup>
// 等价 bottom-loader 指令（app/components/directives/bottom-loader.js）：
// 监听最近可滚动祖先的滚动，触底（parent.clientHeight + scrollTop + 10 >= scrollHeight）
// 经 500ms 防抖触发 loadMore；挂载后立即检查一次（内容不足一屏自动续载）。
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { findScrollParent } from '../../../services/scroll-parent.js';

const props = defineProps({
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  text: { type: String, default: 'loading more...' },
});
const emit = defineEmits(['loadMore']);

const el = ref(null);
let timer = null;
let scroller = null;

function findScroller() {
  // P5（R-P5-06）：与滚动父级查找逻辑共用（services/scroll-parent.js）
  return findScrollParent(el.value);
}

function check() {
  if (props.disabled) return;
  const node = el.value;
  const parent = scroller || (node && node.parentElement);
  if (!node || !parent) return;
  if (node.scrollHeight > 0 && parent.clientHeight + parent.scrollTop + 10 >= node.scrollHeight) {
    emit('loadMore');
  }
}

function onScroll() {
  clearTimeout(timer);
  timer = setTimeout(check, 500);
}

onMounted(() => {
  scroller = findScroller();
  if (scroller && typeof scroller.addEventListener === 'function') {
    scroller.addEventListener('scroll', onScroll);
  }
  timer = setTimeout(check, 0);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  if (scroller && typeof scroller.removeEventListener === 'function') {
    scroller.removeEventListener('scroll', onScroll);
  }
});

defineExpose({ check });
</script>

<style scoped>
.bottom-loader {
  text-align: center;
  padding: 6px;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
</style>