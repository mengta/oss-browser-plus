<template>
  <div v-if="visible" class="tp-mask" data-testid="theme-picker" @mousedown.self="cancel">
    <div class="tp-panel" role="dialog" :aria-label="t('theme.picker.title')">
      <div class="tp-title">{{ t('theme.picker.title') }}</div>
      <input
        ref="inputEl"
        v-model="keyword"
        type="text"
        class="tp-input"
        data-testid="theme-input"
        :placeholder="t('theme.picker.placeholder')"
        spellcheck="false"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="cancel"
      />
      <div class="tp-list" role="listbox">
        <button
          v-for="(option, idx) in filtered"
          :key="option.value"
          type="button"
          class="tp-item"
          :class="{ active: idx === active, selected: option.value === ui.themeMode }"
          :data-testid="'theme-option-' + option.value"
          role="option"
          :aria-selected="option.value === ui.themeMode"
          @click="pick(option)"
        >
          <AppIcon :name="option.icon" class="tp-icon" />
          <span class="tp-label">{{ option.label }}</span>
          <span class="tp-desc">{{ option.desc }}</span>
          <AppIcon v-if="option.value === ui.themeMode" name="check" class="tp-check" />
        </button>
        <div v-if="filtered.length === 0" class="tp-empty">{{ t('nodata') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// VS Code 颜色主题快速选择器（Preferences: Color Theme）：
// Ctrl+K Ctrl+T 打开；↑↓ 即时预览，Enter 确认，Esc/点击遮罩恢复原主题。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';
import { useUiStore } from '../../stores/ui.js';

const { t } = useI18n();
const ui = useUiStore();

const inputEl = ref(null);
const keyword = ref('');
const active = ref(0);
let originalMode = 'dark';
let chordTimer = null;
let kPressed = false;

const visible = computed(() => ui.themePickerOpen);

const options = computed(() => [
  { value: 'dark', icon: 'moon', label: t('theme.dark'), desc: 'Visual Studio Dark+' },
  { value: 'light', icon: 'sun', label: t('theme.light'), desc: 'Visual Studio Light+' },
  { value: 'system', icon: 'monitor', label: t('theme.system'), desc: t('theme.picker.systemDesc') },
]);

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return options.value;
  return options.value.filter(
    (o) =>
      o.label.toLowerCase().indexOf(k) !== -1 ||
      o.desc.toLowerCase().indexOf(k) !== -1 ||
      o.value.indexOf(k) !== -1
  );
});

function currentIndex() {
  const idx = filtered.value.findIndex((o) => o.value === ui.themeMode);
  return idx < 0 ? 0 : idx;
}

watch(visible, (open) => {
  if (!open) {
    keyword.value = '';
    return;
  }
  originalMode = ui.themeMode;
  keyword.value = '';
  active.value = currentIndex();
  nextTick(() => {
    if (inputEl.value) inputEl.value.focus();
  });
});

watch(keyword, () => {
  active.value = currentIndex();
});

function move(delta) {
  const n = filtered.value.length;
  if (n === 0) return;
  active.value = (active.value + delta + n) % n;
  ui.setTheme(filtered.value[active.value].value);
}

function pick(option) {
  if (!option) return;
  ui.setTheme(option.value);
  ui.closeThemePicker();
}

function commit() {
  pick(filtered.value[active.value]);
}

function cancel() {
  ui.setTheme(originalMode);
  ui.closeThemePicker();
}

function onKeydown(event) {
  const plain = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
  const key = String(event.key || '').toLowerCase();
  if (plain && key === 'k') {
    kPressed = true;
    if (chordTimer) clearTimeout(chordTimer);
    chordTimer = setTimeout(() => {
      kPressed = false;
    }, 800);
    return;
  }
  if (plain && key === 't' && kPressed) {
    kPressed = false;
    if (chordTimer) clearTimeout(chordTimer);
    if (visible.value) return;
    event.preventDefault();
    ui.openThemePicker();
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  if (chordTimer) clearTimeout(chordTimer);
});

defineExpose({ commit, cancel });
</script>

<style scoped>
.tp-mask {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: var(--vsc-mask);
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.tp-panel {
  margin-top: 56px;
  width: 480px;
  max-width: 92vw;
  background: var(--vsc-bg-elevated);
  border: 1px solid var(--vsc-border-strong);
  border-radius: 2px;
  box-shadow: var(--vsc-shadow);
  overflow: hidden;
  padding-bottom: 4px;
}
.tp-title {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--vsc-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.tp-input {
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-top: 1px solid var(--vsc-border);
  border-bottom: 1px solid var(--vsc-border);
  background: var(--vsc-bg-input);
  color: var(--vsc-fg);
  font-size: 13px;
  outline: none;
}
.tp-list {
  max-height: 320px;
  overflow: auto;
  padding: 4px 0;
}
.tp-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: var(--vsc-fg);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.tp-item.selected:not(.active) {
  background: var(--vsc-bg-hover);
}
.tp-item.active {
  background: var(--vsc-bg-active);
  color: var(--vsc-on-accent);
}
.tp-icon {
  width: 15px;
  height: 15px;
}
.tp-label {
  flex: 0 0 auto;
}
.tp-desc {
  flex: 1;
  color: var(--vsc-fg-muted);
  font-size: 11px;
}
.tp-item.active .tp-desc {
  color: var(--vsc-on-accent);
  opacity: 0.8;
}
.tp-check {
  width: 14px;
  height: 14px;
  color: var(--vsc-accent);
}
.tp-item.active .tp-check {
  color: var(--vsc-on-accent);
}
.tp-empty {
  padding: 14px;
  text-align: center;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
</style>