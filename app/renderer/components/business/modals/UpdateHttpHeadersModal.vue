<template>
  <BaseModal :visible="true" :title="t('http.headers')" :mask-closable="false" @close="onCancel">
    <HttpHeadersEditor ref="editor" :headers="headers" :meta-items="metaItems" />
    <template #footer>
      <button type="button" class="st-btn st-btn-success" data-testid="http-headers-submit" @click="onSubmit">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="http-headers-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import HttpHeadersEditor from '../editors/HttpHeadersEditor.vue';
import ossClient from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';

// 等价 updateHttpHeadersModalCtrl：单文件 getMeta 回显 → 提交时
// ContentType→Content-Type 等 Header 映射转换 + 空 key/value 过滤 →
// Promise.all(setMeta2) → success Toast；提交后立即关闭（不等 promise，等价原版）。
const props = defineProps({
  item: { type: Array, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();

const editor = ref(null);
const headers = ref({
  ContentLanguage: '',
  ContentType: '',
  CacheControl: '',
  ContentDisposition: '',
  ContentEncoding: '',
  Expires: '',
});
const metaItems = ref([]);

const HeadersMap = {
  ContentLanguage: 'Content-Language',
  ContentType: 'Content-Type',
  CacheControl: 'Cache-Control',
  ContentDisposition: 'Content-Disposition',
  ContentEncoding: 'Content-Encoding',
  Expires: 'Expires',
};

onMounted(() => {
  if (props.item.length > 1) {
    return;
  }
  ossClient
    .getMeta(props.currentInfo.region, props.currentInfo.bucket, props.item[0].path)
    .then((result) => {
      headers.value = {
        ContentLanguage: result.ContentLanguage,
        ContentType: result.ContentType,
        CacheControl: result.CacheControl,
        ContentDisposition: result.ContentDisposition,
        ContentEncoding: result.ContentEncoding,
        Expires: result.Expires,
      };
      const metas = [];
      for (const k in result.Metadata) {
        metas.push({ key: k, value: result.Metadata[k] });
      }
      metaItems.value = metas;
    })
    .catch(() => {});
});

function onCancel() {
  emit('close');
}

function onSubmit() {
  const raw = editor.value ? editor.value.getHeaders() : { ...headers.value };
  const metaList = editor.value ? editor.value.getMetaItems() : metaItems.value;

  const converted = {};
  for (const k in raw) {
    if (raw[k]) {
      converted[HeadersMap[k]] = raw[k];
    }
  }

  const metas = {};
  metaList.forEach((n) => {
    if (n.key && n.value) {
      metas[n.key] = n.value;
    }
  });

  toast.push(t('setting.on'), 'info', 1000);
  Promise.all(
    props.item.map((i) =>
      ossClient.setMeta2(props.currentInfo.region, props.currentInfo.bucket, i.path, converted, metas)
    )
  ).then(() => {
    toast.push(t('setting.success'), 'success', 1000);
  });
  emit('close');
}
</script>

<style scoped>
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-success {
  background: var(#2ea043);
  border-color: #2ea043;
  color: var(--vsc-on-accent);
}
</style>