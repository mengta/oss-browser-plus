<template>
  <div
    v-if="visible"
    ref="el"
    class="context-menu"
    :style="{ left: left + 'px', top: top + 'px' }"
    data-testid="context-menu"
    @mousedown.stop
    @contextmenu.prevent
  >
    <template v-for="item in visibleItems" :key="item.key">
      <div v-if="item.divider" class="cm-divider" />
      <button
        v-else
        type="button"
        class="cm-item"
        :class="{ disabled: item.disabled }"
        :data-testid="'ctx-' + item.key"
        :disabled="item.disabled"
        @click="choose(item)"
      >
        <AppIcon :name="item.icon || 'fallback'" :class="item.iconClass || ''" />
        <span class="cm-label">{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>

<script setup>
// 等价原版 contextmenu 指令（自研，VR-12-01）：
// 视口内边界调整、Esc/外部点击/滚动关闭、disabled 不触发。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
});

const emit = defineEmits(['select', 'close']);

const el = ref(null);
const left = ref(props.x);
const top = ref(props.y);

const visibleItems = computed(() => (props.items || []).filter((item) => !item.hidden));

function adjust() {
  if (!el.value) return;
  left.value = props.x;
  top.value = props.y;
  const rect = el.value.getBoundingClientRect();
  const margin = 8;
  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 1024) - rect.width - margin;
  const maxTop = (typeof window !== 'undefined' ? window.innerHeight : 768) - rect.height - margin;
  if (left.value > maxLeft) left.value = Math.max(margin, maxLeft);
  if (top.value > maxTop) top.value = Math.max(margin, maxTop);
}

watch(
  () => props.visible,
  (next) => {
    if (next) {
      nextTick(adjust);
    }
  }
);

watch(() => [props.x, props.y], () => {
  if (props.visible) nextTick(adjust);
});

function choose(item) {
  if (!item || item.disabled) return;
  emit('select', item.key);
  emit('close');
}

function onDocMouseDown(event) {
  if (!props.visible) return;
  if (el.value && el.value.contains(event.target)) return;
  emit('close');
}

function onKeydown(event) {
  if (!props.visible) return;
  if (event.key === 'Escape') {
    emit('close');
  }
}

function onScroll() {
  if (props.visible) emit('close');
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown, true);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown, true);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
});
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1200;
  min-width: 160px;
  padding: 4px 0;
  background: var(--vsc-bg-elevated);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.175);
}
.cm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 14px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
}
.cm-item:hover {
  background: var(--vsc-bg-hover);
}
.cm-item.disabled {
  color: var(--vsc-fg-muted);
  cursor: not-allowed;
}
.cm-item.disabled:hover {
  background: none;
}
.cm-label {
  flex: 1;
}
.cm-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--vsc-border-weak);
}
</style>