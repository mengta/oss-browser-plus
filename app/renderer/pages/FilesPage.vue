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
      <!-- B3-05：FileToolbar + FileList（list/blocks、选中、分页触底、空态）；
           上传/下载/移动/复制/重命名/删除/恢复/软链/授权/地址弹窗由 B3-06~B3-14 接入（事件暂静默） -->
      <FileToolbar
        :paste-pending="false"
        @upload="onToolbarAction('upload', $event)"
        @mkdir="onToolbarAction('mkdir', $event)"
        @download="onToolbarAction('download', $event)"
        @copy="onToolbarAction('copy', $event)"
        @move="onToolbarAction('move', $event)"
        @rename="onToolbarAction('rename', $event)"
        @grant="onToolbarAction('grant', $event)"
        @grant-token="onToolbarAction('grant-token', $event)"
        @address="onToolbarAction('address', $event)"
        @restore="onToolbarAction('restore', $event)"
        @symlink="onToolbarAction('symlink', $event)"
        @delete="onToolbarAction('delete', $event)"
        @paste="onToolbarAction('paste', $event)"
        @cancel-paste="onToolbarAction('cancel-paste', $event)"
      />
      <div v-if="filesStore.isLoading" class="loading" data-testid="files-loading">…</div>
      <FileList v-else @preview="onPreview" @action="onFileAction" />
    </div>

    <!-- B3-08：TransferDock 占位 -->
  </div>
</template>

<script setup>
// B3-02：文件页骨架（等价 files.html 顶层布局）。
// 未登录 onMounted 判定跳 /login（无全局守卫）；账号切换先 filesStore.reset() 再重写会话。
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AddressBar from '../components/business/files/AddressBar.vue';
import BucketToolbar from '../components/business/files/BucketToolbar.vue';
import BucketList from '../components/business/files/BucketList.vue';
import FileToolbar from '../components/business/files/FileToolbar.vue';
import FileList from '../components/business/files/FileList.vue';
import { useFilesStore } from '../stores/files.js';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const filesStore = useFilesStore();
const authStore = useAuthStore();

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

// 工具栏动作分发：弹窗本体由 B3-06（上传/下载）/B3-09~B3-11（文件操作）承接
function onToolbarAction(type, payload) {
  void type;
  void payload;
}

// 名称链接/双击：预览弹窗由 B3-12 承接
function onPreview(item) {
  void item;
}

// 行内操作（address/download/restore/delete）：B3-09~B3-13 承接
function onFileAction(event) {
  void event;
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
</style>