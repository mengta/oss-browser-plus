<template>
  <template v-for="entry in ui.stack" :key="entry.name">
    <ConfirmDialog
      v-if="entry.payload && entry.payload.kind"
      :kind="entry.payload.kind"
      :title="entry.payload.title"
      :message="entry.payload.message"
      :cls="entry.payload.cls"
      :ok-text="entry.payload.okText"
      :cancel-text="entry.payload.cancelText"
      @ok="onDialogClose(entry, true)"
      @cancel="onDialogClose(entry, false)"
    />
    <component
      :is="registry[entry.name]"
      v-else-if="registry[entry.name]"
      v-bind="entry.payload || {}"
      @close="(result) => onModalClose(entry, result)"
      @goTo="(url) => onGoTo(url)"
    />
  </template>
</template>

<script setup>
import { defineAsyncComponent, watch } from 'vue';
import { useUiStore } from '../../stores/ui.js';
import { useFilesStore } from '../../stores/files.js';
import { useRouter } from 'vue-router';
import ConfirmDialog from './ConfirmDialog.vue';
import SettingsModal from '../business/modals/SettingsModal.vue';
import UsersModal from '../business/modals/UsersModal.vue';
import UserAkModal from '../business/modals/UserAkModal.vue';
import UserUpdateModal from '../business/modals/UserUpdateModal.vue';
import AboutModal from '../business/modals/AboutModal.vue';
import FavListModal from '../business/modals/FavListModal.vue';
import UpdateAclModal from '../business/modals/UpdateAclModal.vue';
import UpdateHttpHeadersModal from '../business/modals/UpdateHttpHeadersModal.vue';
import DiffModal from '../business/modals/DiffModal.vue';
import AddBucketModal from '../business/modals/AddBucketModal.vue';
import UpdateBucketModal from '../business/modals/UpdateBucketModal.vue';
import BucketMultipartModal from '../business/modals/BucketMultipartModal.vue';
import DeleteFilesModal from '../business/modals/DeleteFilesModal.vue';
import AddFolderModal from '../business/modals/AddFolderModal.vue';
import RenameModal from '../business/modals/RenameModal.vue';
import MoveModal from '../business/modals/MoveModal.vue';
import RestoreModal from '../business/modals/RestoreModal.vue';
import BatchRestoreModal from '../business/modals/BatchRestoreModal.vue';
import SetSymlinkModal from '../business/modals/SetSymlinkModal.vue';
import CrcModal from '../business/modals/CrcModal.vue';
import GetAddressModal from '../business/modals/GetAddressModal.vue';
import GrantTokenModal from '../business/modals/GrantTokenModal.vue';
import GrantModalCode from '../business/modals/GrantModalCode.vue';
import GrantModal from '../business/modals/GrantModal.vue';
// 预览类弹窗按需加载：首屏不必解析图片/媒体/文档/代码预览代码
const PictureModal = defineAsyncComponent(() => import('../business/preview/PictureModal.vue'));
const MediaModal = defineAsyncComponent(() => import('../business/preview/MediaModal.vue'));
const DocModal = defineAsyncComponent(() => import('../business/preview/DocModal.vue'));
const OthersModal = defineAsyncComponent(() => import('../business/preview/OthersModal.vue'));
const CodeModal = defineAsyncComponent(() => import('../business/preview/CodeModal.vue'));

// 弹窗宿主：渲染 ui.stack。
// dialog-* 项由 ConfirmDialog 承载；业务弹窗按 registry 注册表渲染。
// BRIDGE-B2：栈非空时给 body 加 vue-modal-open（Angular 文件页期间显示 #vue-app 弹窗层）。
const registry = {
  settings: SettingsModal,
  users: UsersModal,
  'user-ak': UserAkModal,
  'user-update': UserUpdateModal,
  about: AboutModal,
  'fav-list': FavListModal,
  'update-acl': UpdateAclModal,
  'update-http-headers': UpdateHttpHeadersModal,
  diff: DiffModal,
  // B3-04：Bucket 管理弹窗（名称与 BucketToolbar/BucketList uiStore.open 调用对齐）
  'add-bucket': AddBucketModal,
  'update-bucket': UpdateBucketModal,
  'bucket-multipart': BucketMultipartModal,
  // B3-09：文件操作弹窗（删除/新建目录/重命名/复制移动）
  'delete-files': DeleteFilesModal,
  'add-folder': AddFolderModal,
  rename: RenameModal,
  move: MoveModal,
  // B3-10：恢复（单个/批量）、软链接、CRC
  restore: RestoreModal,
  'batch-restore': BatchRestoreModal,
  symlink: SetSymlinkModal,
  crc: CrcModal,
  'get-address': GetAddressModal,
  'grant-token': GrantTokenModal,
  'grant-code': GrantModalCode,
  grant: GrantModal,
  // B3-11：四类预览 + 文本预览（B3-12 增强）
  'preview-picture': PictureModal,
  'preview-media': MediaModal,
  'preview-doc': DocModal,
  'preview-others': OthersModal,
  'preview-code': CodeModal,
};

const ui = useUiStore();
const filesStore = useFilesStore();
const router = useRouter();

watch(
  () => ui.stack.length,
  (depth) => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('vue-modal-open', depth > 0);
    }
  }
);

function onDialogClose(entry, result) {
  ui.close(entry.name, result);
}

function onModalClose(entry, result) {
  ui.close(entry.name, result === undefined ? null : result);
}

// 收藏跳转（R-06：去除 Angular 广播，直接在 Vue 内导航）
function onGoTo(url) {
  filesStore.navigate(url).catch(() => {});
  router.push('/').catch(() => {});
}
</script>