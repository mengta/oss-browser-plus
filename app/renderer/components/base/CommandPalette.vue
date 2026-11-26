<template>
  <div v-if="visible" class="cp-mask" data-testid="command-palette" @mousedown.self="close">
    <div class="cp-panel">
      <input
        ref="inputEl"
        v-model="keyword"
        type="text"
        class="cp-input"
        data-testid="command-input"
        placeholder="Type a command… (Ctrl+Shift+P)"
        spellcheck="false"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="exec(active)"
        @keydown.esc.prevent="close"
      />
      <div class="cp-list">
        <button
          v-for="(c, idx) in filtered"
          :key="c.id"
          type="button"
          class="cp-item"
          :class="{ active: idx === active }"
          :data-testid="'command-' + c.id"
          @click="exec(idx)"
        >
          <AppIcon :name="c.icon || 'fallback'" class="cp-icon" />
          <span class="cp-label">{{ c.label }}</span>
          <span v-if="c.shortcut" class="cp-key">{{ c.shortcut }}</span>
        </button>
        <div v-if="filtered.length === 0" class="cp-empty">{{ t('nodata') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// VS Code 命令面板：Ctrl+Shift+P / F1 打开，输入过滤，↑↓ 选择，Enter 执行，Esc/遮罩关闭。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  commands: { type: Array, default: () => [] },
});

const { t } = useI18n();
const visible = ref(false);
const keyword = ref('');
const active = ref(0);
const inputEl = ref(null);

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  const list = props.commands || [];
  if (!k) return list;
  return list.filter(
    (c) => String(c.label).toLowerCase().indexOf(k) !== -1 || String(c.id).indexOf(k) !== -1
  );
});

function open() {
  if (!props.commands || props.commands.length === 0) return;
  visible.value = true;
  keyword.value = '';
  active.value = 0;
  nextTick(() => {
    if (inputEl.value) inputEl.value.focus();
  });
}

function close() {
  visible.value = false;
}

function move(delta) {
  const n = filtered.value.length;
  if (n === 0) return;
  active.value = (active.value + delta + n) % n;
}

function exec(index) {
  const cmd = filtered.value[index];
  if (!cmd) return;
  close();
  try {
    if (typeof cmd.run === 'function') cmd.run();
  } catch (err) {
    /* 命令失败不阻断界面 */
  }
}

function onKeydown(event) {
  const isPalette =
    ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'P' || event.key === 'p')) ||
    event.key === 'F1';
  if (isPalette) {
    event.preventDefault();
    if (visible.value) close();
    else open();
  }
}

watch(keyword, () => {
  active.value = 0;
});

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

defineExpose({ open, close });
</script>

<style scoped>
.cp-mask {
  position: fixed;
  inset: 0;
  background: var(--vsc-mask);
  z-index: 1400;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.cp-panel {
  margin-top: 72px;
  width: 560px;
  max-width: 90vw;
  background: var(--vsc-bg-elevated);
  border: 1px solid var(--vsc-border-strong);
  border-radius: 2px;
  box-shadow: var(--vsc-shadow);
  overflow: hidden;
}
.cp-input {
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid var(--vsc-border);
  background: var(--vsc-bg-input);
  color: var(--vsc-fg);
  font-size: 13px;
  outline: none;
}
.cp-list {
  max-height: 320px;
  overflow: auto;
  padding: 4px 0;
}
.cp-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--vsc-fg);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.cp-item:hover,
.cp-item.active {
  background: var(--vsc-bg-active);
  color: var(--vsc-on-accent);
}
.cp-icon {
  width: 14px;
  height: 14px;
}
.cp-label {
  flex: 1;
}
.cp-key {
  color: var(--vsc-fg-muted);
  font-size: 11px;
}
.cp-empty {
  padding: 14px;
  text-align: center;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
</style>