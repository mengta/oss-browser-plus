<template>
  <div class="files-page" data-testid="files-page">
    <AddressBar ref="addressBar" />
    <!-- SubAddressBar：与原版 files.html 一致保持禁用（STS 授权场景备用） -->

    <div v-if="filesStore.isBucketList" class="section" data-testid="bucket-section">
      <BucketToolbar />
    </div>

    <div v-else class="section" data-testid="object-section">
      <!-- B3-05：FileToolbar（list/blocks、选中、分页触底、空态）；
           上传/下载/移动/复制/重命名/删除/恢复/软链/授权/地址弹窗由 B3-06~B3-14 接入 -->
      <FileToolbar
        :paste-pending="!!keepMoveOptions"
        :paste-count="keepMoveOptions ? keepMoveOptions.items.length : 0"
        :paste-is-copy="keepMoveOptions ? keepMoveOptions.isCopy : false"
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
    </div>

    <!-- B3-13：auto-height（-130）包裹列表区，等价 files.html 的 file-list-box -->
    <AutoHeightBox :offset="-130" class="file-list-box">
      <div v-if="filesStore.isLoading" class="loading" data-testid="files-loading">…</div>
      <template v-else>
        <BucketList v-if="filesStore.isBucketList" @contextmenu="onBucketContextMenu" @spacer-contextmenu="onBucketSpacerMenu" />
        <DropZone v-else class="drop-area" @dropped="uploadFromPaths">
          <FileList
            @preview="onPreview"
            @action="onFileAction"
            @contextmenu="onFileContextMenu"
            @spacer-contextmenu="onFileSpacerMenu"
          />
        </DropZone>
      </template>
    </AutoHeightBox>

    <!-- B3-20：等价原版 mock.uploads 调试入口（E2E 注入绝对路径触发上传；600ms 防抖） -->
    <input
      v-if="filesStore.bucket"
      type="text"
      class="mock-uploads"
      ng-model="mock.uploads"
      data-testid="mock-uploads"
      @change="onMockUploads"
    />

    <!-- B3-08：传输中心（折叠双计数 + 双 tab 面板，等价 frame.html） -->
    <TransferDock />

    <!-- B3-14：对象/桶右键菜单 -->
    <ContextMenu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :items="menu.items"
      @select="onMenuSelect"
      @close="menu.visible = false"
    />
  </div>
</template>

<script setup>
// B3-02：文件页骨架（等价 files.html 顶层布局）。
// 未登录 onMounted 判定跳 /login（无全局守卫）；账号切换先 filesStore.reset() 再重写会话。
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AddressBar from '../components/business/files/AddressBar.vue';
import BucketToolbar from '../components/business/files/BucketToolbar.vue';
import BucketList from '../components/business/files/BucketList.vue';
import FileToolbar from '../components/business/files/FileToolbar.vue';
import FileList from '../components/business/files/FileList.vue';
import DropZone from '../components/base/DropZone.vue';
import TransferDock from '../components/business/transfer/TransferDock.vue';
import AutoHeightBox from '../components/base/AutoHeightBox.vue';
import ContextMenu from '../components/base/ContextMenu.vue';
import { useFilesStore } from '../stores/files.js';
import { useAuthStore } from '../stores/auth.js';
import { useTransferStore } from '../stores/transfer.js';
import { useToastStore } from '../stores/toast.js';
import { useBootstrapStore } from '../stores/bootstrap.js';
import { useUiStore } from '../stores/ui.js';
import { getFileType } from '../services/file-type.js';
import { ossClient } from '../services/oss-client.js';

const { t } = useI18n();
const router = useRouter();
const filesStore = useFilesStore();
const authStore = useAuthStore();
const transferStore = useTransferStore();
const toastStore = useToastStore();
const bootstrapStore = useBootstrapStore();
const ui = useUiStore();

// B3-09：复制/移动的“暂存选择”（等价 files.js keepMoveOptions），导航后仍保留，粘贴时以当前目录为目标
const keepMoveOptions = ref(null);

// B3-14：自研右键菜单状态（等价原版 contextmenu 指令）
const menu = reactive({ visible: false, x: 0, y: 0, items: [], context: null });
const isMac = typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent);

function initSession() {
  // 等价原版 goHome：预设 ossPath 优先，其次「保存为首页」的 auth.address
  const info = authStore.info || {};
  const osspath = info.osspath || info.address;
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
      keepMoveOptions.value = null;
      if (authStore.isLoggedIn) {
        initSession();
      }
    }
  }
);

// 工具栏动作分发：上传/下载经 B3-06/07 链路；删除/新建目录/重命名/复制/移动/粘贴由 B3-09 承接；
// 恢复/软链/授权/地址/HTTP 头等弹窗由 B3-10~B3-13 后续批次承接（暂静默）。
function onToolbarAction(type, payload) {
  switch (type) {
    case 'upload':
      pickFiles(!!payload);
      return;
    case 'download':
      pickDownloadFolder(payload);
      return;
    case 'mkdir':
      openAddFolder();
      return;
    case 'delete':
      openDelete(payload);
      return;
    case 'rename':
      openRename(payload && payload[0]);
      return;
    case 'copy':
      startMove(payload, true);
      return;
    case 'move':
      startMove(payload, false);
      return;
    case 'paste':
      doPaste();
      return;
    case 'cancel-paste':
      keepMoveOptions.value = null;
      return;
    case 'restore':
      openRestoreBatch(payload);
      return;
    case 'symlink':
      openSymlink(payload && payload[0]);
      return;
    case 'address':
      openAddress(payload && payload[0]);
      return;
    case 'grant':
      openGrant(payload);
      return;
    case 'grant-token':
      openGrantToken(payload && payload[0]);
      return;
    default:
      void payload;
  }
}

function bucketInfo() {
  return { region: filesStore.region, bucket: filesStore.bucket, key: filesStore.prefix };
}

// ---------- B3-09：删除 / 新建目录 / 重命名 / 复制移动 ----------
function openDelete(items) {
  if (!items || items.length === 0) return;
  ui.open('delete-files', { items: items.slice(), currentInfo: bucketInfo() });
}

function openAddFolder() {
  if (readOnly()) return;
  ui.open('add-folder', { currentInfo: bucketInfo() });
}

function openRename(item) {
  if (!item) return;
  const info = bucketInfo();
  ui.open('rename', { item, moveTo: info, currentInfo: info, isCopy: false });
}

function startMove(items, isCopy) {
  if (!items || items.length === 0) return;
  keepMoveOptions.value = { items: items.slice(), isCopy: !!isCopy, currentInfo: bucketInfo() };
}

// 等价 files.js showPaste：单对象且同 Bucket 走 rename（可改名）；同目录移动提示不支持；
// 其余先确认（paste.message1）再执行 move 弹窗（复制/移动进度）。
async function doPaste() {
  const keep = keepMoveOptions.value;

  if (!keep) return;
  const current = bucketInfo();
  const action = keep.isCopy ? t('copy') : t('move');

  if (keep.items.length === 1 && current.bucket === keep.currentInfo.bucket) {
    ui.open('rename', {
      item: keep.items[0],
      moveTo: current,
      currentInfo: keep.currentInfo,
      isCopy: keep.isCopy,
    }).then((result) => {
      if (result) keepMoveOptions.value = null;
    });
    return;
  }

  if (
    current.key === keep.currentInfo.key &&
    !keep.isCopy &&
    current.bucket === keep.currentInfo.bucket
  ) {
    toastStore.push(t('forbidden'), 'warn', 3000);
    return;
  }

  const message = t('paste.message1', { name: keep.items[0].name, action });
  const confirmed = await ui.confirm(action, message);
  if (!confirmed) return;

  ui.open('move', {
    items: keep.items.slice(),
    moveTo: current,
    isCopy: keep.isCopy,
    renamePath: '',
    fromInfo: keep.currentInfo,
    onComplete: () => {
      keepMoveOptions.value = null;
      setTimeout(() => filesStore.loadObjects(true), 100);
    },
  }).then((result) => {
    if (result) keepMoveOptions.value = null;
  });
}


// 只读账号拦截（等价原版 readOnly 对文件写操作入口的禁用）
function readOnly() {
  return (authStore.info && authStore.info.privilege) === 'readOnly';
}

// ---------- B3-10：恢复（单/批量）、软链接 ----------
// 等价 showRestoreBatch：仅取 Archive 且未恢复可读（storageStatus!==3）的对象
function restorable(items) {
  return (items || []).filter(
    (it) => it && it.storageClass === 'Archive' && it.storageStatus !== 3
  );
}

function openRestoreBatch(items) {
  const list = restorable(items);
  if (list.length === 0) {
    toastStore.push(t('restore.msg'), 'info', 3000);
    return;
  }
  ui.open('batch-restore', { items: list, currentInfo: bucketInfo() });
}

function openRestore(item) {
  if (!item) return;
  ui.open('restore', { item, currentInfo: bucketInfo() });
}

function openSymlink(item) {
  if (!item) return;
  ui.open('symlink', { item, currentInfo: bucketInfo() });
}

function openAddress(item) {
  if (!item) return;
  ui.open('get-address', { item, currentInfo: bucketInfo() });
}

// 简化 Policy 授权 / 生成授权码（B3-10）
function openGrant(items) {
  if (!items || items.length === 0) return;
  ui.open('grant', { items: items.slice(), currentInfo: bucketInfo() });
}

function openGrantToken(item) {
  if (!item) return;
  ui.open('grant-token', { item, currentInfo: bucketInfo() });
}

// ---------- B3-14：右键菜单（对象/桶；等价原版 contextmenu 菜单项与条件） ----------
function isStsAccount() {
  const id = (authStore.info && authStore.info.id) || '';
  return id.indexOf('STS.') === 0;
}

function openMenu(event, items, context) {
  menu.items = items;
  menu.context = context || null;
  menu.x = event && typeof event.clientX === 'number' ? event.clientX : 0;
  menu.y = event && typeof event.clientY === 'number' ? event.clientY : 0;
  menu.visible = true;
}

// 原版 fileMenuOptions：右键未选中行时先清空并选中该行
function ensureRowSelected(item, index) {
  if (filesStore.selectedMap['i_' + index]) return;
  filesStore.clearSelection();
  filesStore.selectedMap = { ['i_' + index]: true };
  filesStore.selectedList = [item];
  filesStore.selectedAll = filesStore.items.length === 1;
  filesStore.lastSelectedIndex = index;
}

function fileMenuItems() {
  const sel = filesStore.selectedList || [];
  const single = sel.length === 1;
  const first = sel[0] || {};
  const ro = readOnly();
  const sts = isStsAccount();
  return [
    { key: 'download', label: t('download'), icon: 'cloud-download', iconClass: 'text-info', disabled: sel.length === 0 },
    { key: 'copy', label: t('copy'), icon: 'copy', disabled: ro },
    { key: 'move', label: t('move'), icon: 'cut', disabled: ro },
    { key: 'rename', label: t('rename'), icon: 'edit', disabled: !(single && !ro && first.storageClass !== 'Archive') },
    { key: 'acl', label: t('acl'), icon: 'shield', iconClass: 'text-success', disabled: !(single && !first.isFolder && !ro) },
    { key: 'grant', label: t('simplePolicy'), icon: 'shield', iconClass: 'text-warning', disabled: sts },
    { key: 'grant-token', label: t('genAuthToken'), icon: 'shield', iconClass: 'text-success', disabled: !(single && first.isFolder && !sts) },
    { key: 'address', label: t('getAddress'), icon: 'download', disabled: !(single && !first.isFolder && !sts) },
    { key: 'http-headers', label: t('http.headers'), icon: 'cog', disabled: !(sel.length && sel.every((x) => !x.isFolder)) },
    { key: 'symlink', label: t('file.op.set_symlink'), icon: 'soft-link', disabled: !(single && !first.isFolder && first.type !== 'Symlink') },
    { key: 'delete', label: t('delete'), icon: 'trash', iconClass: 'text-danger', disabled: ro },
  ];
}

function onFileContextMenu(payload) {
  const { event, item, index } = payload || {};
  ensureRowSelected(item, index);
  openMenu(event, fileMenuItems(), { kind: 'file' });
}

function onFileSpacerMenu(event) {
  const ro = readOnly();
  const items = [];
  if (isMac) {
    items.push({ key: 'upload-files', label: t('upload'), icon: 'cloud-upload', iconClass: 'text-info', disabled: ro });
  } else {
    items.push({ key: 'upload-files', label: t('file'), icon: 'cloud-upload', iconClass: 'text-info', disabled: ro });
    items.push({ key: 'upload-folder', label: t('folder'), icon: 'folder', iconClass: 'text-info', disabled: ro });
  }
  items.push({ key: 'mkdir', label: t('folder.create'), icon: 'plus', iconClass: 'text-success', disabled: ro });
  if (keepMoveOptions.value) {
    items.push({
      key: 'paste',
      label: t('paste') + '(' + keepMoveOptions.value.items.length + ')',
      icon: 'paste',
      iconClass: 'text-primary',
    });
  }
  openMenu(event, items, { kind: 'spacer' });
}

function onBucketContextMenu(payload) {
  const { event, item } = payload || {};
  openMenu(
    event,
    [
      { key: 'bucket-multipart', label: t('bucket.multipart'), icon: 'copy' },
      { key: 'bucket-acl', label: t('acl'), icon: 'shield', iconClass: 'text-success' },
      { key: 'bucket-grant', label: t('simplePolicy'), icon: 'shield', iconClass: 'text-warning' },
      { key: 'bucket-delete', label: t('delete'), icon: 'trash', iconClass: 'text-danger' },
    ],
    { kind: 'bucket', item }
  );
}

function onBucketSpacerMenu(event) {
  openMenu(
    event,
    [{ key: 'bucket-add', label: t('bucket.add'), icon: 'plus', iconClass: 'text-success', disabled: isStsAccount() }],
    { kind: 'bucket-spacer' }
  );
}

function onMenuSelect(key) {
  const sel = filesStore.selectedList || [];
  switch (key) {
    case 'download':
      pickDownloadFolder(sel.slice());
      break;
    case 'copy':
      startMove(sel, true);
      break;
    case 'move':
      startMove(sel, false);
      break;
    case 'rename':
      openRename(sel[0]);
      break;
    case 'acl':
      if (sel[0]) ui.open('update-acl', { item: sel[0], currentInfo: bucketInfo() });
      break;
    case 'grant':
      openGrant(sel);
      break;
    case 'grant-token':
      openGrantToken(sel[0]);
      break;
    case 'address':
      openAddress(sel[0]);
      break;
    case 'http-headers':
      if (sel.length) ui.open('update-http-headers', { item: sel.slice(), currentInfo: bucketInfo() });
      break;
    case 'symlink':
      openSymlink(sel[0]);
      break;
    case 'delete':
      openDelete(sel);
      break;
    case 'upload-files':
      pickFiles(false);
      break;
    case 'upload-folder':
      pickFiles(true);
      break;
    case 'mkdir':
      openAddFolder();
      break;
    case 'paste':
      doPaste();
      break;
    case 'bucket-multipart':
      if (menu.context && menu.context.item) ui.open('bucket-multipart', { bucketInfo: menu.context.item });
      break;
    case 'bucket-acl':
      if (menu.context && menu.context.item) ui.open('update-bucket', { bucketInfo: menu.context.item });
      break;
    case 'bucket-grant':
      if (menu.context && menu.context.item) openBucketGrant(menu.context.item);
      break;
    case 'bucket-delete':
      if (menu.context && menu.context.item) deleteBucketFromMenu(menu.context.item);
      break;
    case 'bucket-add':
      addBucketFromMenu();
      break;
    default:
      break;
  }
}

let mockUploadsTimer = null;
function onMockUploads(event) {
  const value = String((event && event.target && event.target.value) || '');
  event.target.value = '';
  if (!value) return;
  if (mockUploadsTimer) clearTimeout(mockUploadsTimer);
  mockUploadsTimer = setTimeout(() => {
    const paths = value.split(',').map((p) => p.trim()).filter(Boolean);
    if (paths.length) uploadFromPaths(paths);
  }, 600);
}

function openBucketGrant(bucket) {
  ui.open('grant', {
    items: [{ name: bucket.name, region: bucket.region, itemType: 'bucket', path: '' }],
    currentInfo: { region: bucket.region, bucket: bucket.name, key: '' },
  });
}

async function deleteBucketFromMenu(bucket) {
  const confirmed = await ui.confirm(t('bucket.delete.title'), t('bucket.delete.message', { name: bucket.name }), {
    okText: t('delete'),
    cancelText: t('cancel'),
    cls: 'danger',
  });
  if (!confirmed) return;
  try {
    await ossClient.deleteBucket(bucket.region, bucket.name);
    toastStore.push(t('bucket.delete.success'), 'success', 2000);
    if (filesStore.bucketSelected && filesStore.bucketSelected.name === bucket.name) {
      filesStore.bucketSelected = null;
    }
    setTimeout(() => filesStore.loadBuckets(), 1000);
  } catch (err) {
    toastStore.push((err && err.message) || 'delete bucket failed', 'danger', 4000);
  }
}

function addBucketFromMenu() {
  if (isStsAccount()) return;
  ui.open('add-bucket').then((result) => {
    if (result) {
      toastStore.push(t('bucket.add.success'), 'success', 2000);
      setTimeout(() => filesStore.loadBuckets(), 1000);
    }
  });
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

// 名称链接/双击：按文件类型选择预览弹窗（B3-11：图片/音视频/文档/其他；code 由 B3-12 增强）
const PREVIEW_MODALS = {
  picture: 'preview-picture',
  video: 'preview-media',
  audio: 'preview-media',
  doc: 'preview-doc',
  code: 'preview-code',
};

function onPreview(item) {
  if (!item) return;
  const fileType = getFileType(item);
  const name = PREVIEW_MODALS[fileType.type] || 'preview-others';
  ui.open(name, { objectInfo: item, bucketInfo: bucketInfo(), fileType });
}

// 行内操作（address/download/restore/delete）：download 经 B3-07 落地；其余 B3-09~B3-13 承接
function onFileAction(event) {
  if (!event) return;
  if (event.type === 'download') {
    pickDownloadFolder([event.item]);
    return;
  }
  if (event.type === 'delete') {
    openDelete([event.item]);
    return;
  }
  if (event.type === 'restore') {
    openRestore(event.item);
    return;
  }
  if (event.type === 'address') {
    openAddress(event.item);
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
  color: var(--vsc-fg-muted);
}
</style>