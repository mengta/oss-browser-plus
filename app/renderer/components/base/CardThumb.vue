<template>
  <div ref="root" class="card-thumb">
    <img
      v-if="url"
      :src="url"
      class="card-thumb-img"
      alt=""
      loading="lazy"
      data-testid="card-thumb-img"
      @error="onError"
    />
    <AppIcon v-else name="image" class="card-thumb-placeholder" />
  </div>
</template>

<script setup>
// 图片对象缩略图：可见时才向主进程申请带 image/resize 的签名 URL，避免整目录批量签名与下载原图。
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { ossClient } from '../../services/oss-client.js';

const props = defineProps({
  region: { type: String, default: '' },
  bucket: { type: String, default: '' },
  item: { type: Object, required: true },
  size: { type: Number, default: 64 },
});

const root = ref(null);
const url = ref('');
const failed = ref(false);
let observer = null;

function load() {
  if (url.value || failed.value || !props.region || !props.bucket) return;
  const path = props.item && props.item.path;
  if (!path) return;
  const process = 'image/resize,m_fill,w_' + props.size + ',h_' + props.size;
  ossClient.signatureUrl2(props.region, props.bucket, path, 900, process).then(
    (value) => {
      if (value) url.value = String(value);
      else failed.value = true;
    },
    () => {
      failed.value = true;
    }
  );
}

function onError() {
  url.value = '';
  failed.value = true;
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    load();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        load();
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    },
    { rootMargin: '120px' }
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});
</script>

<style scoped>
.card-thumb {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  overflow: hidden;
  background: var(--vsc-bg-input);
}
.card-thumb-img {
  width: 32px;
  height: 32px;
  object-fit: cover;
}
.card-thumb-placeholder {
  width: 16px;
  height: 16px;
  color: var(--vsc-fg-dim);
}
</style>