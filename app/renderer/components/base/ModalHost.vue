<template>
  <template v-for="entry in ui.stack" :key="entry.name">
    <ConfirmDialog
      v-if="entry.payload && entry.payload.kind"
      :kind="entry.payload.kind"
      :title="entry.payload.title"
      :message="entry.payload.message"
      :cls="entry.payload.cls"
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
import { watch } from 'vue';
import { useUiStore } from '../../stores/ui.js';
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
};

const ui = useUiStore();

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

// 收藏跳转：转发给 Angular 广播（goToOssAddress），无宿主时忽略
function onGoTo(url) {
  const angularHost = typeof window !== 'undefined' ? window.vueModalAngularHost : null;
  if (angularHost && typeof angularHost.broadcast === 'function') {
    angularHost.broadcast('goToOssAddress', url);
  }
}
</script>