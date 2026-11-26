<template>
  <div class="import-config-panel" data-testid="import-config-panel">
    <textarea v-model="text" class="ic-text" data-testid="ic-text" @input="doParse"></textarea>
    <div class="ic-preview">
      <div v-for="(value, key) in parsed" :key="key" class="ic-row" :data-testid="'ic-row-' + key">
        <span class="ic-label">{{ fieldLabel(key) }}</span>
        <code class="ic-value">{{ key === 'secret' && !showSecret ? maskSecret(value) : value }}</code>
      </div>
    </div>
    <p v-if="parseError" class="ic-error" data-testid="ic-error">{{ parseError }}</p>
    <div class="ic-actions">
      <button type="button" class="ic-btn" :disabled="!parsed" data-testid="ic-import" @click="doImport">
        导入
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { parse, FIELD_LABELS } from '../../../services/import-config-parser.js';
import { maskSecret } from '../../../services/formatters.js';
import { useToastStore } from '../../../stores/toast.js';

const emit = defineEmits(['import', 'close']);
const { t } = useI18n();
const toast = useToastStore();

const text = ref('');
const parsed = ref(null);
const parseError = ref('');
const showSecret = ref(false);

function doParse() {
  const result = parse(text.value || '');
  parsed.value = result.data || null;
  parseError.value = result.error ? t('auth.importConfig.error.invalid') : '';
}

function doImport() {
  if (!parsed.value) {
    return;
  }
  emit('import', Object.assign({}, parsed.value));
  toast.push(t('auth.importConfig.success'), 'success', 1500);
  emit('close');
}

function fieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

function readClipboard() {
  const sys = window.ossBrowser && window.ossBrowser.system;
  if (!sys) {
    return;
  }
  sys.clipboardReadText().then(
    (res) => {
      const clip = res && res.ok ? res.data : '';
      if (clip && clip.trim()) {
        text.value = clip;
        doParse();
      }
    },
    () => {}
  );
}

readClipboard();
</script>

<style scoped>
.import-config-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ic-text {
  min-height: 150px;
  padding: 8px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  font-family: monospace;
  font-size: 12px;
}
.ic-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ic-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
}
.ic-label {
  min-width: 140px;
  color: var(--vsc-fg-muted);
}
.ic-value {
  word-break: break-all;
}
.ic-error {
  color: #a1260d;
  font-size: 12px;
  margin: 0;
}
.ic-actions {
  display: flex;
  justify-content: flex-end;
}
.ic-btn {
  padding: 4px 14px;
  border: 1px solid var(--vsc-accent);
  background: var(--vsc-accent);
  color: var(--vsc-on-accent);
  border-radius: 2px;
  cursor: pointer;
}
.ic-btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>