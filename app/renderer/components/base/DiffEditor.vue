<template>
  <div ref="host" class="diff-editor" data-testid="diff-editor"></div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';

// DiffEditor（CM6 MergeView，替代 CM5 CodeMirror.MergeView + diff_match_patch）：
// 双栏 diff、左栏 original 只读、右栏当前内容（readonly 时整体只读）；
// 等价原版 highlightDifferences/connect align/collapseIdentical/revertButtons:false。
const props = defineProps({
  original: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  language: { type: String, default: '' },
});

const emit = defineEmits(['ready']);

const host = ref(null);
let mergeView = null;

function languageExtensions(name) {
  if (name === 'json') {
    return [json()];
  }
  return [];
}

onMounted(() => {
  const readonlyExt = [EditorState.readOnly.of(true), EditorView.editable.of(false)];
  mergeView = new MergeView({
    a: {
      doc: props.original,
      extensions: languageExtensions(props.language).concat(readonlyExt),
    },
    b: {
      doc: props.modelValue,
      extensions: languageExtensions(props.language).concat(
        props.readonly ? readonlyExt : []
      ),
    },
    parent: host.value,
    gutter: true,
    collapseUnchanged: { margin: 3 },
    revertControls: props.readonly ? null : 'b-to-a',
  });
  emit('ready', mergeView);
});

onUnmounted(() => {
  if (mergeView) {
    mergeView.a.destroy();
    mergeView.b.destroy();
    mergeView = null;
  }
});

function getValue() {
  return mergeView ? mergeView.b.state.doc.toString() : '';
}

defineExpose({ getValue });
</script>

<style scoped>
.diff-editor {
  height: 400px;
  text-align: left;
}
.diff-editor :deep(.cm-mergeView) {
  height: 400px;
}
.diff-editor :deep(.cm-merge-view) {
  height: 400px;
}
.diff-editor :deep(.cm-editor) {
  font-size: 12px;
  height: 400px;
}
</style>