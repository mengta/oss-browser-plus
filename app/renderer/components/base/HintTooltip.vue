<template>
  <span
    ref="trigger"
    class="hint-tooltip"
    :class="cls"
    tabindex="0"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
  >
    <slot>?</slot>
    <Teleport to="body">
      <div
        v-if="visible"
        ref="tip"
        class="hint-pop"
        :style="popStyle"
        role="tooltip"
        @mouseenter="cancelHide"
        @mouseleave="hide"
      >
        {{ text }}
        <a v-if="linkUrl" class="hint-link" href="javascript:void(0)" data-testid="hint-link" @click="openLink">{{ linkText }}</a>
      </div>
    </Teleport>
  </span>
</template>

<script setup>
// VS Code 风格帮助浮窗（替代原生 title：Electron 下不弹出/延迟不可控）。
// 触发：hover / focus；定位：trigger 下方居中，自动夹取视口并翻转；Teleport 到 body 避免被容器裁剪。
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  text: { type: String, default: '' },
  cls: { type: String, default: '' },
  maxWidth: { type: Number, default: 280 },
  linkUrl: { type: String, default: '' },
  linkText: { type: String, default: 'requestPayer' },
});

const trigger = ref(null);
const tip = ref(null);
const visible = ref(false);
const popStyle = ref({});
let hideTimer = null;

function position() {
  if (!trigger.value || !tip.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const tipRect = tip.value.getBoundingClientRect();
  const margin = 8;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  let top = rect.bottom + 6;
  if (top + tipRect.height > window.innerHeight - margin) {
    top = rect.top - tipRect.height - 6;
  }
  if (left + tipRect.width > window.innerWidth - margin) {
    left = window.innerWidth - tipRect.width - margin;
  }
  if (left < margin) left = margin;
  if (top < margin) top = margin;
  popStyle.value = {
    left: left + 'px',
    top: top + 'px',
    maxWidth: props.maxWidth + 'px',
  };
}

function show() {
  if (!props.text) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  visible.value = true;
  nextTick(position);
}

function cancelHide() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// 延迟隐藏：允许从触发点移动到浮窗内点击文档链接
function hide() {
  cancelHide();
  hideTimer = setTimeout(() => {
    visible.value = false;
    hideTimer = null;
  }, 160);
}

function openLink() {
  if (!props.linkUrl) return;
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (system && typeof system.openExternal === 'function') {
    system.openExternal(props.linkUrl).catch(() => {});
  }
}

watch(
  () => props.text,
  () => {
    if (visible.value) nextTick(position);
  }
);
</script>

<style scoped>
.hint-tooltip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.hint-pop {
  position: fixed;
  z-index: 1600;
  padding: 6px 8px;
  background: var(--vsc-bg-elevated, #252526);
  color: var(--vsc-fg, #cccccc);
  border: 1px solid var(--vsc-border-strong, #454545);
  border-radius: 2px;
  box-shadow: var(--vsc-shadow, 0 6px 18px rgba(0, 0, 0, 0.45));
  font-size: 12px;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
  pointer-events: auto;
}
.hint-link {
  color: var(--vsc-link, #3794ff);
  text-decoration: underline;
  cursor: pointer;
}
</style>