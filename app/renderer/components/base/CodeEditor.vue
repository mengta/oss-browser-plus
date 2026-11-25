<template>
  <div ref="host" class="code-editor" data-testid="code-editor"></div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

// CodeMirror 6 封装（等价 ui-codemirror + onLoad）：
// 统一 API 为 v-model / readonly / language / onReady（D-15 / R-V3-04）。
const props = defineProps({
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  language: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'ready']);

const host = ref(null);
let view = null;

function languageExtensions(name) {
  if (name === 'json') {
    return [json()];
  }
  return [];
}

function buildExtensions() {
  const exts = [
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    history(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString());
      }
    }),
  ];
  exts.push(...languageExtensions(props.language));
  exts.push(EditorState.readOnly.of(props.readonly));
  exts.push(EditorView.editable.of(!props.readonly));
  return exts;
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: buildExtensions(),
    }),
    parent: host.value,
  });
  emit('ready', view);
});

onUnmounted(() => {
  if (view) {
    view.destroy();
    view = null;
  }
});

watch(
  () => props.modelValue,
  (next) => {
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (next === current) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next == null ? '' : next },
    });
  }
);

watch(
  () => props.readonly,
  (next) => {
    if (!view) {
      return;
    }
    view.dispatch({
      effects: [
        EditorState.reconfigure.of(buildExtensions()),
      ],
    });
  }
);

defineExpose({
  getView: () => view,
});
</script>

<style scoped>
.code-editor {
  border: 1px solid #ccc;
  border-radius: 3px;
  text-align: left;
}
.code-editor :deep(.cm-editor) {
  font-size: 12px;
}
.code-editor :deep(.cm-editor.cm-focused) {
  outline: none;
}
</style>