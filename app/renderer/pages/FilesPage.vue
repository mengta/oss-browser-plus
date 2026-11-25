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
      <DropZone v-else class="drop-area" @dropped="uploadFromPaths">
        <FileList @preview="onPreview" @action="onFileAction" />
      </DropZone>
    </div>

    <!-- B3-08：传输中心（折叠双计数 + 双 tab 面板，等价 frame.html） -->
    <TransferDock />
  </div>
</template>

<script setup>
// B3-02：文件页骨架（等价 files.html 顶层布局）。
// 未登录 onMounted 判定跳 /login（无全局守卫）；账号切换先 filesStore.reset() 再重写会话。
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AddressBar from '../components/business/files/AddressBar.vue';
import BucketToolbar from '../components/business/files/BucketToolbar.vue';
import BucketList from '../components/business/files/BucketList.vue';
import FileToolbar from '../components/business/files/FileToolbar.vue';
import FileList from '../components/business/files/FileList.vue';
import DropZone from '../components/base/DropZone.vue';
import TransferDock from '../components/business/transfer/TransferDock.vue';
import { useFilesStore } from '../stores/files.js';
import { useAuthStore } from '../stores/auth.js';
import { useTransferStore } from '../stores/transfer.js';
import { useToastStore } from '../stores/toast.js';
import { useBootstrapStore } from '../stores/bootstrap.js';

const { t } = useI18n();
const router = useRouter();
const filesStore = useFilesStore();
const authStore = useAuthStore();
const transferStore = useTransferStore();
const toastStore = useToastStore();
const bootstrapStore = useBootstrapStore();

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

// 工具栏动作分发：上传/下载经 B3-06/07 链路落地；其余弹窗由 B3-09~B3-14 承接（暂静默）
function onToolbarAction(type, payload) {
  if (type === 'upload') {
    pickFiles(!!payload);
    return;
  }
  if (type === 'download') {
    pickDownloadFolder(payload);
    return;
  }
  void payload;
}

function bucketInfo() {
  return { region: filesStore.region, bucket: filesStore.bucket, key: filesStore.prefix };
}

// 等价 Dialog.showUploadDialog：isFolder → openDirectory+多选；Mac 覆盖三属性
async function pickFiles(isFolder) {
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (!system || typeof system.showOpenDialog !== 'function') return;
  const isMac = (bootstrapStore.snapshot && bootstrapStore.snapshot.platform) === 'darwin';
  const properties = isMac
    ? ['openFile', 'openDirectory', 'multiSelections']
    : isFolder
      ? ['openDirectory', 'multiSelections']
      : ['openFile', 'multiSelections'];
  try {
    const res = await system.showOpenDialog({ title: 'Upload', properties });
    const data = res && res.ok ? res.data : null;
    if (data && !data.canceled && data.filePaths && data.filePaths.length > 0) {
      await uploadFromPaths(data.filePaths);
    }
  } catch (err) {
    /* 取消/失败静默 */
  }
}

// 选择/拖拽共用：入队 → Toast（等价 upload.addtolist.on/success）→ 展示面板 → 刷新当前目录
async function uploadFromPaths(paths) {
  if (!filesStore.bucket || !paths || paths.length === 0) return;
  toastStore.push(t('upload.addtolist.on'), 'info', 1000);
  await transferStore.createUploadJobs(paths, bucketInfo());
  toastStore.push(t('upload.addtolist.success'), 'success', 2000);
  transferStore.setVisible(true, 'upload');
  filesStore.loadObjects(true);
}

// 名称链接/双击：预览弹窗由 B3-12 承接
function onPreview(item) {
  void item;
}

// 行内操作（address/download/restore/delete）：download 经 B3-07 落地；其余 B3-09~B3-13 承接
function onFileAction(event) {
  if (!event) return;
  if (event.type === 'download') {
    pickDownloadFolder([event.item]);
    return;
  }
  void event;
}

// 等价 Dialog.showDownloadDialog：openDirectory 选择下载目录 → createDownloadJobs
async function pickDownloadFolder(items) {
  if (!items || items.length === 0 || !filesStore.bucket) return;
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (!system || typeof system.showOpenDialog !== 'function') return;
  try {
    const res = await system.showOpenDialog({ title: 'Download', properties: ['openDirectory'] });
    const data = res && res.ok ? res.data : null;
    if (!data || data.canceled || !data.filePaths || data.filePaths.length === 0) return;
    const toLocal = String(data.filePaths[0]).replace(/[\\/]+$/, '');
    toastStore.push(t('download.addtolist.on'), 'info', 1000);
    await transferStore.createDownloadJobs(items, toLocal, bucketInfo());
    toastStore.push(t('download.addtolist.success'), 'success', 2000);
    transferStore.setVisible(true, 'download');
  } catch (err) {
    /* 取消/失败静默 */
  }
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