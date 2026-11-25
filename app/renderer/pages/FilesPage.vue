<template>
  <div class="files-page" data-testid="files-page">
    <AddressBar ref="addressBar" />
    <!-- SubAddressBar：与原版 files.html 一致保持禁用（STS 授权场景备用） -->

    <div v-if="filesStore.isBucketList" class="section" data-testid="bucket-section">
      <BucketToolbar />
      <div v-if="filesStore.isLoading" class="loading" data-testid="files-loading">…</div>
      <BucketList v-else />
    </div>

    <div v-else class="section" data-testid="object-section">
      <!-- B3-05：FileToolbar/FileList/LongScrollList 在位后替换占位；B3-06/08：传输中心 -->
      <div v-if="filesStore.isLoading" class="loading" data-testid="files-loading">…</div>
      <EmptyState v-else-if="filesStore.items.length === 0" icon="inbox" :text="t('files.noData')" />
      <div v-else class="placeholder-list" data-testid="object-placeholder">
        <div
          v-for="(item, index) in filesStore.items"
          :key="item.path"
          class="placeholder-row"
          @dblclick="enterFolder(item)"
        >
          {{ item.name }}
        </div>
      </div>
    </div>

    <!-- B3-08：TransferDock 占位 -->
  </div>
</template>

<script setup>
// B3-02：文件页骨架（等价 files.html 顶层布局）。
// 未登录 onMounted 判定跳 /login（无全局守卫）；账号切换先 filesStore.reset() 再重写会话。
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AddressBar from '../components/business/files/AddressBar.vue';
import BucketToolbar from '../components/business/files/BucketToolbar.vue';
import BucketList from '../components/business/files/BucketList.vue';
import EmptyState from '../components/base/EmptyState.vue';
import { useFilesStore } from '../stores/files.js';
import { useAuthStore } from '../stores/auth.js';

const { t } = useI18n();
const router = useRouter();
const filesStore = useFilesStore();
const authStore = useAuthStore();
const addressBar = ref(null);

function initSession() {
  const osspath = authStore.info && authStore.info.osspath;
  if (osspath) {
    filesStore.navigate(osspath);
  } else if (!filesStore.bucketsLoaded) {
    filesStore.loadBuckets();
  }
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    router.replace('/login');
    return;
  }
  initSession();
});

// 账号切换：先 reset 再写新会话（无上一账号残留）
watch(
  () => authStore.info && authStore.info.id,
  (nextId, prevId) => {
    if (nextId !== prevId) {
      filesStore.reset();
      if (authStore.isLoggedIn) {
        initSession();
      }
    }
  }
);

function enterBucket(b) {
  if (addressBar.value && typeof addressBar.value.setAddress === 'function') {
    addressBar.value.setAddress('oss://' + b.name + '/');
  } else {
    filesStore.navigate('oss://' + b.name + '/');
  }
}

function enterFolder(item) {
  filesStore.enterFolder(item);
}
</script>

<style scoped>
.files-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.section {
  flex: 1;
  min-height: 200px;
  overflow: auto;
}
.loading {
  padding: 24px;
  text-align: center;
  color: #999;
}
.placeholder-list {
  padding: 4px 0;
}
.placeholder-row {
  padding: 6px 14px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.placeholder-row:hover {
  background: #f5f5f5;
}
</style>