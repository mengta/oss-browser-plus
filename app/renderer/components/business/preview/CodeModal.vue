<template>
  <BaseModal :visible="true" :title="t('preview') + ' (' + sizeText + ')'" :mask-closable="false" @close="onClose">
    <div class="preview-modal" data-testid="code-modal">
      <header class="path break">oss://{{ bucketInfo.bucket }}/{{ objectInfo.path }}</header>
      <RestoreChecker
        :bucket-info="bucketInfo"
        :object-info="objectInfo"
        :file-type="fileType"
        @ready="onReady"
      >
        <div class="content">
          <div v-if="tooLarge" class="too-large" data-testid="code-too-large">
            <div>
              {{ t('filesize') }}
              <code>{{ sizeText }} > {{ maxSizeText }}</code>,
              {{ t('codepreview.notsupport') }}
            </div>
            <button type="button" class="st-btn" data-testid="code-download" @click="download">
              {{ t('download.file') }}
            </button>
          </div>

          <div v-else-if="error" class="alert-danger" data-testid="code-error">{{ error }}</div>
          <div v-else-if="loading" class="loading">{{ t('loading') }}</div>
          <CodeEditor
            v-else
            v-model="content"
            :readonly="readonly"
            :language="language"
            class="editor"
          />
        </div>
      </RestoreChecker>
    </div>
    <template #footer>
      <PreviewBar v-if="ready" :object-info="objectInfo" :bucket-info="bucketInfo" />
      <span class="spacer" />
      <button
        v-if="ready && canSave"
        type="button"
        class="st-btn st-btn-primary"
        data-testid="code-save"
        @click="save"
      >
        {{ t('save') }}
      </button>
      <button type="button" class="st-btn" data-testid="code-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 code-modal（app/main/files/modals/preview/code-modal.js）：
// ≤5MB 文本/代码只读预览（Symlink 强制只读）；超限提示下载；保存先 Diff 确认再 saveContent。
// CodeMirror6 封装见 base/CodeEditor.vue（模式：json 高亮，其余纯文本，语言包按 D-15 收敛）。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import RestoreChecker from './RestoreChecker.vue';
import PreviewBar from './PreviewBar.vue';
import CodeEditor from '../../base/CodeEditor.vue';
import { ossClient } from '../../../services/oss-client.js';
import { sizeFormat } from '../../../services/file-size.js';
import { pickDownloadFolder } from '../../../services/file-actions.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';

const MAX_SIZE = 5 * 1024 * 1024;

const props = defineProps({
  objectInfo: { type: Object, required: true },
  bucketInfo: { type: Object, required: true },
  fileType: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const authStore = useAuthStore();
const toast = useToastStore();
const ui = useUiStore();

const content = ref('');
const originalContent = ref('');
const error = ref('');
const loading = ref(true);
const ready = ref(false);

const sizeText = computed(() => sizeFormat(props.objectInfo.size));
const maxSizeText = computed(() => sizeFormat(MAX_SIZE));
const tooLarge = computed(() => Number(props.objectInfo.size || 0) > MAX_SIZE);
const readonly = computed(() => props.objectInfo.type === 'Symlink');
const canSave = computed(() => {
  const privilege = (authStore.info && authStore.info.privilege) || '';
  return !readonly.value && privilege !== 'readOnly';
});
const language = computed(() => {
  const ext = (props.fileType && props.fileType.ext) || [];
  return ext[0] === 'json' ? 'json' : '';
});

function decodeContent(resp) {
  const body = resp && resp.content != null ? resp.content : resp;
  if (typeof body === 'string') return body;
  try {
    if (body && typeof body === 'object' && body.type === 'Buffer' && Array.isArray(body.data)) {
      return new TextDecoder('utf-8').decode(new Uint8Array(body.data));
    }
    if (body instanceof Uint8Array) {
      return new TextDecoder('utf-8').decode(body);
    }
  } catch (err) {
    /* 解码失败按字符串兜底 */
  }
  return String(body == null ? '' : body);
}

function loadContent() {
  if (tooLarge.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const info = props.bucketInfo || {};
  ossClient
    .getContent(info.region, info.bucket, props.objectInfo.path)
    .then((resp) => {
      const text = decodeContent(resp);
      originalContent.value = text;
      content.value = text;
    })
    .catch((err) => {
      error.value = (err && err.message) || t('cannot.preview');
    })
    .finally(() => {
      loading.value = false;
    });
}

function onReady() {
  ready.value = true;
  loadContent();
}

function save() {
  if (content.value === originalContent.value) {
    toast.push(t('content.isnot.modified'), 'info', 2000);
    return;
  }
  ui.open('diff', {
    title: 'Diff',
    originalContent: originalContent.value,
    content: content.value,
  }).then((modified) => {
    if (typeof modified !== 'string') return;
    const info = props.bucketInfo || {};
    toast.push(t('saving'), 'info', 1500);
    ossClient
      .saveContent(info.region, info.bucket, props.objectInfo.path, modified, true)
      .then(() => {
        toast.push(t('save.successfully'), 'success', 2000);
        emit('close', true);
      })
      .catch((err) => {
        toast.push((err && err.message) || 'save failed', 'danger', 4000);
      });
  });
}

async function download() {
  const res = await pickDownloadFolder([props.objectInfo], props.bucketInfo);
  if (res && res.ok) {
    toast.push(t('download.addtolist.success'), 'success', 2000);
  }
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.preview-modal {
  min-width: 640px;
  max-width: 90vw;
}
.path {
  padding: 6px 10px;
  background: var(--vsc-success-bg);
  color: var(--vsc-success);
  font-size: 12px;
}
.break {
  word-break: break-all;
}
.content {
  padding: 10px;
}
.editor {
  border: 1px solid var(--vsc-border);
  max-height: 60vh;
  overflow: auto;
}
.too-large {
  margin: 30px auto 0;
  text-align: center;
}
.too-large button {
  margin-top: 10px;
}
.loading {
  color: var(--vsc-fg-muted);
  padding: 20px;
}
.alert-danger {
  padding: 10px;
  background: var(--vsc-danger-bg);
  color: var(--vsc-danger);
  border-radius: 2px;
}
.spacer {
  flex: 1;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-primary {
  background: var(--vsc-accent);
  border-color: var(--vsc-accent-hover);
  color: var(--vsc-on-accent);
}
</style>