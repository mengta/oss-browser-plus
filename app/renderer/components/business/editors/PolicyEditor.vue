<template>
  <div class="policy-editor" data-testid="policy-editor">
    <div v-if="invalid" class="text-danger" data-testid="policy-invalid">{{ invalidMessage }}</div>
    <CodeEditor
      v-model="text"
      :language="language"
      :readonly="readonly"
      data-testid="policy-code-editor"
      @ready="(view) => emit('ready', view)"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import CodeEditor from '../../base/CodeEditor.vue';

// 策略 JSON 编辑器（等价 grant-modal 的 policy textarea + CodeMirror 高亮）：
// 校验失败时仅提示，原始输入不丢失（v-model 保留原文本，invalid 不清空）。
const props = defineProps({
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  language: { type: String, default: 'json' },
  invalidMessage: { type: String, default: 'Invalid JSON' },
});

const emit = defineEmits(['update:modelValue', 'ready']);

const text = ref(props.modelValue || '');

const invalid = computed(() => {
  if (!text.value || !text.value.trim()) {
    return false;
  }
  try {
    JSON.parse(text.value);
    return false;
  } catch (err) {
    return true;
  }
});

watch(
  () => props.modelValue,
  (next) => {
    if (next !== text.value) {
      text.value = next == null ? '' : next;
    }
  }
);

watch(text, (next) => {
  emit('update:modelValue', next);
});
</script>

<style scoped>
.policy-editor {
  min-width: 480px;
}
.text-danger {
  color: var(--vsc-danger);
  font-size: 12px;
  margin-bottom: 4px;
}
</style>