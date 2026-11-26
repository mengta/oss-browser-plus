<template>
  <div
    ref="el"
    class="drop-zone"
    data-testid="drop-zone"
    @dragenter.prevent="onDragEnter"
    @dragleave.prevent="onDragLeave"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
  >
    <slot />
    <div v-if="highlight" class="drop-overlay" data-testid="drop-overlay" />
  </div>
</template>

<script setup>
// 等价 drop-zone 指令（app/components/directives/drop-zone.js）：
// 拖入高亮遮罩 + drop 取路径 + document 级兜底阻止浏览器默认打开文件。
// Electron 32+ 无 File.path：经 system.getPathForFile（preload webUtils）解析绝对路径。
import { onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits(['dropped']);
const el = ref(null);
const highlight = ref(false);

function stopPrev(e) {
  e.stopPropagation();
  e.preventDefault();
}

function onDragEnter(e) {
  highlight.value = true;
}

function onDragLeave(e) {
  // 离开到子元素时不取消高亮（等价原版遮罩移除语义的近似）
  if (e && e.relatedTarget && el.value && el.value.contains(e.relatedTarget)) return;
  highlight.value = false;
}

function onDragOver() {
  highlight.value = true;
}

function systemApi() {
  return typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
}

function onDrop(e) {
  highlight.value = false;
  const api = systemApi();
  const files = e && e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
  const paths = [];
  for (const f of files) {
    let p = '';
    if (api && typeof api.getPathForFile === 'function') {
      try {
        // net-bridge 统一返回 { ok, data }；同步方法同样需取 data
        const res = api.getPathForFile(f);
        p = res && res.ok === true ? String(res.data || '') : typeof res === 'string' ? res : '';
      } catch (err) {
        p = '';
      }
    }
    if (!p && f && typeof f.path === 'string') {
      p = f.path; // 旧版本兼容（Electron < 32）
    }
    if (p) paths.push(p);
  }
  if (paths.length > 0) {
    emit('dropped', paths);
  }
}

const docHandlers = { dragover: stopPrev, drop: stopPrev };

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('dragover', stopPrev);
    document.addEventListener('drop', stopPrev);
  }
});

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('dragover', stopPrev);
    document.removeEventListener('drop', stopPrev);
  }
});

defineExpose({ docHandlers });
</script>

<style scoped>
.drop-zone {
  position: relative;
}
.drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 122, 204, 0.15);
  box-shadow: inset 0 0 10px var(--vsc-accent);
  z-index: 20;
  pointer-events: none;
}
</style>