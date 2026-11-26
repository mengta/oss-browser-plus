<template>
  <div class="cleanable-input">
    <input
      ref="inputEl"
      v-bind="$attrs"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :autocomplete="autocomplete"
      class="cleanable-input-el"
      :data-testid="$attrs['data-testid'] || 'cleanable-input'"
      @input="onInput"
    />
    <button
      v-if="clearable && modelValue"
      class="cleanable-input-clear"
      type="button"
      data-testid="cleanable-clear"
      @click="clear"
    >
      ×
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });

defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
  autocomplete: { type: String, default: 'off' },
});

const emit = defineEmits(['update:modelValue', 'clear']);
const inputEl = ref(null);

function onInput(event) {
  emit('update:modelValue', event.target.value);
}

function clear() {
  emit('update:modelValue', '');
  emit('clear');
  if (inputEl.value) {
    inputEl.value.focus();
  }
}

defineExpose({ focus: () => inputEl.value && inputEl.value.focus() });
</script>

<style scoped>
.cleanable-input {
  position: relative;
  display: flex;
  width: 100%;
}
.cleanable-input-el {
  flex: 1;
  padding-right: 26px;
}
.cleanable-input-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: var(--vsc-fg-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
</style>