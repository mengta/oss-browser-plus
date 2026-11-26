<template>
  <div class="bucket-toolbar" data-testid="bucket-toolbar">
    <button
      type="button"
      class="btn btn-default"
      data-testid="bucket-add"
      :disabled="isStsAccount"
      :title="isStsAccount ? 'STS' : ''"
      @click="showAddBucket"
    >
      + {{ t('bucket.add') }}
    </button>
    <span class="divider" />
    <button
      type="button"
      class="btn btn-default"
      data-testid="bucket-multipart"
      :disabled="!filesStore.bucketSelected"
      @click="showBucketMultipart"
    >
      {{ t('bucket.multipart') }}
    </button>
    <button
      type="button"
      class="btn btn-default"
      data-testid="bucket-acl"
      :disabled="!filesStore.bucketSelected"
      @click="showUpdateBucket"
    >
      {{ t('acl') }}
    </button>
    <button
      type="button"
      class="btn btn-default"
      data-testid="bucket-grant"
      :disabled="!filesStore.bucketSelected"
      @click="showGrant"
    >
      {{ t('simplePolicy') }}
    </button>
    <span class="divider" />
    <button
      type="button"
      class="btn btn-default"
      data-testid="bucket-more-delete"
      :disabled="!filesStore.bucketSelected"
      @click="showDeleteBucket"
    >
      {{ t('delete') }}
    </button>

    <div class="spacer" />

    <div class="search-box">
      <input
        v-model="filesStore.bucketFilter"
        type="text"
        class="form-control"
        data-testid="bucket-search"
        :placeholder="t('bucket.name')"
        spellcheck="false"
      />
      <span class="badge" data-testid="bucket-count">{{ filesStore.filteredBuckets.length }}</span>
    </div>
    <ListViewOptions />
  </div>
</template>

<script setup>
// 等价 bucket-toolbar（app/main/files/_/bucket-toolbar.html）：
// 新建/碎片/ACL/简化Policy/删除入口 + 客户端名称过滤 + 视图切换。
// 弹窗本体 B3-04 承接（uiStore.open 名称与 ModalHost registry 对齐）；删除就地确认+刷新。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ListViewOptions from './ListViewOptions.vue';
import { useFilesStore } from '../../../stores/files.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';
import { ossClient } from '../../../services/oss-client.js';

const { t } = useI18n();
const filesStore = useFilesStore();
const authStore = useAuthStore();
const toastStore = useToastStore();
const uiStore = useUiStore();

// 等价 currentAuthInfo.id 以 STS. 开头时禁用新建
const isStsAccount = computed(() => {
  const id = (authStore.info && authStore.info.id) || '';
  return id.indexOf('STS.') === 0;
});

function showAddBucket() {
  if (isStsAccount.value) return;
  uiStore.open('add-bucket').then((result) => {
    if (result) {
      toastStore.push(t('bucket.add.success'), 'success', 2000);
      setTimeout(() => filesStore.loadBuckets(), 1000);
    }
  });
}

function showBucketMultipart() {
  const b = filesStore.bucketSelected;
  if (!b) return;
  uiStore.open('bucket-multipart', { bucketInfo: b });
}

function showUpdateBucket() {
  const b = filesStore.bucketSelected;
  if (!b) return;
  uiStore.open('update-bucket', { bucketInfo: b }).then((changed) => {
    if (changed) {
      setTimeout(() => filesStore.loadBuckets(), 300);
    }
  });
}

function showGrant() {
  const b = filesStore.bucketSelected;
  if (!b) return;
  uiStore.open('grant', {
    items: [{ name: b.name, region: b.region, itemType: 'bucket', path: '' }],
    currentInfo: { region: b.region, bucket: b.name, key: '' },
  });
}

async function showDeleteBucket() {
  const b = filesStore.bucketSelected;
  if (!b) return;
  const confirmed = await uiStore.confirm({
    title: t('bucket.delete.title'),
    message: t('bucket.delete.message', { name: b.name }),
    okText: t('delete'),
    cancelText: t('cancel'),
  });
  if (!confirmed) return;
  try {
    await ossClient.deleteBucket(b.region, b.name);
    toastStore.push(t('bucket.delete.success'), 'success', 2000);
    filesStore.bucketSelected = null;
    setTimeout(() => filesStore.loadBuckets(), 1000);
  } catch (err) {
    toastStore.push((err && err.message) || 'delete bucket failed', 'danger', 4000);
  }
}
</script>

<style scoped>
.bucket-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
  flex-wrap: wrap;
}
.btn {
  padding: 3px 10px;
}
.divider {
  width: 1px;
  height: 18px;
  background: var(--vsc-border);
}
.spacer {
  flex: 1;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 4px;
}
.search-box .form-control {
  width: 140px;
}
.badge {
  background: var(--vsc-border-weak);
  border-radius: 2px;
  padding: 0 6px;
  font-size: 12px;
}
</style>