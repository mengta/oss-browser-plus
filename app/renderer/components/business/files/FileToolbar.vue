<template>
  <div class="file-toolbar" data-testid="file-toolbar">
    <button type="button" class="btn btn-default" data-testid="file-upload" :disabled="readOnly" @click="emit('upload', false)">
      <AppIcon name="cloud-upload" class="tb-icon" /> {{ isMac ? t('upload') : t('upload') }}
    </button>
    <button v-if="!isMac" type="button" class="btn btn-default" data-testid="file-upload-folder" :disabled="readOnly" @click="emit('upload', true)">
      <AppIcon name="folder" class="tb-icon" /> {{ t('files') }}
    </button>
    <button type="button" class="btn btn-default" data-testid="file-mkdir" :disabled="readOnly" @click="emit('mkdir')">
      <AppIcon name="plus" class="tb-icon" /> {{ t('folder.create') }}
    </button>
    <span class="divider" />
    <label class="check-all">
      <input type="checkbox" :checked="filesStore.selectedAll" :disabled="filesStore.items.length === 0" data-testid="toolbar-check-all" @change="filesStore.selectAll()" />
      {{ t('select.all') }}
    </label>
    <button type="button" class="btn btn-default" data-testid="file-download" :disabled="!selHas" @click="emit('download', filesStore.selectedList)">
      <AppIcon name="download" class="tb-icon" /> {{ t('download') }}
    </button>
    <button type="button" class="btn btn-default" data-testid="file-copy" :disabled="!selHas || readOnly" @click="emit('copy', filesStore.selectedList)">
      <AppIcon name="copy" class="tb-icon" /> {{ t('copy') }}
    </button>

    <!-- 更多下拉（等价 file-toolbar.html:106-242） -->
    <div class="more" data-testid="file-more">
      <button type="button" class="btn btn-default" :disabled="!selHas" @click="showMore = !showMore">
        {{ t('more') }} ▾
      </button>
      <div v-if="showMore" class="dropdown">
        <button type="button" class="dropdown-item" data-testid="more-move" :disabled="!selHas || readOnly" @click="fire('move')">
          <AppIcon name="cut" class="tb-icon" /> {{ t('move') }}
        </button>
        <button
          type="button"
          class="dropdown-item"
          data-testid="more-rename"
          :disabled="!canRename"
          @click="fire('rename')"
        >
          <AppIcon name="edit" class="tb-icon" /> {{ t('rename') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-acl" :disabled="!canAcl" @click="showAcl">
          <AppIcon name="shield" class="tb-icon" /> {{ t('acl') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-grant" :disabled="!selHas || isSts" @click="fire('grant')">
          <AppIcon name="shield" class="tb-icon" /> {{ t('simplePolicy') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-grant-token" :disabled="!canGrantToken" @click="fire('grant-token')">
          <AppIcon name="shield" class="tb-icon" /> {{ t('genAuthToken') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-address" :disabled="!canAddress" @click="fire('address')">
          <AppIcon name="download" class="tb-icon" /> {{ t('getAddress') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-http-headers" :disabled="!canHeaders" @click="showHeaders">
          <AppIcon name="cog" class="tb-icon" /> {{ t('http.headers') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-restore" :disabled="!selHas || !canRestoreAny" @click="fire('restore')">
          <AppIcon name="hourglass" class="tb-icon" /> {{ t('restore') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-symlink" :disabled="!canSymlink" @click="fire('symlink')">
          <AppIcon name="soft-link" class="tb-icon" /> {{ t('file.op.set_symlink') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-delete" :disabled="!selHas || readOnly" @click="fire('delete')">
          <AppIcon name="trash" class="tb-icon" /> {{ t('delete') }}
        </button>
      </div>
    </div>

    <!-- 粘贴组（等价 file-toolbar.html:244-271，keepMoveOptions 存在时显示） -->
    <template v-if="pastePending">
      <button type="button" class="btn btn-default" data-testid="file-paste" @click="emit('paste')">
        <AppIcon name="paste" class="tb-icon" /> {{ t('paste') }}{{ pasteCount ? '(' + pasteCount + ')' : '' }}
      </button>
      <button
        type="button"
        class="btn btn-default"
        data-testid="file-paste-cancel"
        :title="pasteIsCopy ? t('copy.cancel') : t('move.cancel')"
        @click="emit('cancel-paste')"
      >
        {{ t('copy.cancel') }}
      </button>
    </template>

    <div class="spacer" />

    <div class="search-box">
      <input
        v-model="filesStore.searchKeyword"
        type="text"
        class="form-control"
        data-testid="file-search"
        :placeholder="t('search.files.placeholder')"
        spellcheck="false"
        @input="onSearchInput"
      />
      <span class="badge" :title="countTip" data-testid="file-count">
        {{ filesStore.items.length }}{{ filesStore.hasMore ? '+' : '' }}
      </span>
    </div>
    <ListViewOptions />
    <span v-if="!isSts && filesStore.region" class="region" data-testid="file-region">{{ filesStore.region }}</span>
  </div>
</template>

<script setup>
// 等价 file-toolbar（app/main/files/_/file-toolbar.html）：
// 上传/新建目录/全选/下载/复制/更多下拉（移动/重命名/ACL/Policy/授权码/地址/HTTP头/恢复/软链/删除）
// + 粘贴组 + 搜索（600ms 防抖 → 服务端 prefix 过滤）+ 计数（hasMore 时 '+'）+ 视图切换 + 区域。
// 弹窗本体 B3-09/10/11 承接（emit 事件由 FilesPage 分发）；ACL/HTTP 头直连 B2-09 弹窗。
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ListViewOptions from './ListViewOptions.vue';
import AppIcon from '../../base/AppIcon.vue';
import { useFilesStore } from '../../../stores/files.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useBootstrapStore } from '../../../stores/bootstrap.js';
import { useUiStore } from '../../../stores/ui.js';

const props = defineProps({
  pastePending: { type: Boolean, default: false },
  pasteCount: { type: Number, default: 0 },
  pasteIsCopy: { type: Boolean, default: false },
});

const emit = defineEmits([
  'upload',
  'mkdir',
  'download',
  'copy',
  'move',
  'rename',
  'grant',
  'grant-token',
  'address',
  'restore',
  'symlink',
  'delete',
  'paste',
  'cancel-paste',
]);

const { t } = useI18n();
const filesStore = useFilesStore();
const authStore = useAuthStore();
const bootstrapStore = useBootstrapStore();
const ui = useUiStore();

const showMore = ref(false);

const isMac = computed(() => (bootstrapStore.snapshot && bootstrapStore.snapshot.platform) === 'darwin');
const isSts = computed(() => {
  const id = (authStore.info && authStore.info.id) || '';
  return id.indexOf('STS.') === 0;
});
const readOnly = computed(() => (authStore.info && authStore.info.privilege) === 'readOnly');

const selHas = computed(() => filesStore.selectedList.length > 0);
const single = computed(() => filesStore.selectedList.length === 1);
const singleFile = computed(() => single.value && !filesStore.selectedList[0].isFolder);
const singleDir = computed(() => single.value && filesStore.selectedList[0].isFolder);

const canRename = computed(() => {
  const it = filesStore.selectedList[0];
  return single.value && it && it.storageClass !== 'Archive' && !readOnly.value;
});
const canAcl = computed(() => singleFile.value && !readOnly.value);
const canGrantToken = computed(() => singleDir.value && !isSts.value);
const canAddress = computed(() => singleFile.value && !isSts.value);
const canHeaders = computed(() => selHas.value && filesStore.selectedList.every((it) => !it.isFolder));
const canRestoreAny = computed(() => filesStore.selectedList.some((it) => !it.isFolder));
const canSymlink = computed(() => {
  const it = filesStore.selectedList[0];
  return singleFile.value && it && it.type !== 'Symlink';
});

const countTip = computed(() => t('search.files.num_msg', { num: filesStore.items.length }));

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filesStore.search(filesStore.searchKeyword);
  }, 600);
}

onBeforeUnmount(() => clearTimeout(searchTimer));

function fire(type) {
  showMore.value = false;
  emit(type, filesStore.selectedList);
}

function currentInfo() {
  return { region: filesStore.region, bucket: filesStore.bucket };
}

function showAcl() {
  showMore.value = false;
  const item = filesStore.selectedList[0];
  if (!item) return;
  ui.open('update-acl', { item, currentInfo: currentInfo() });
}

function showHeaders() {
  showMore.value = false;
  const item = filesStore.selectedList[0];
  if (!item) return;
  ui.open('update-http-headers', { item, currentInfo: currentInfo() });
}
</script>

<style scoped>
.tb-icon {
  width: 12px;
  height: 12px;
  margin-right: 4px;
  vertical-align: -1px;
}
.file-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--vsc-surface-1);
  border-bottom: 1px solid var(--vsc-border-weak);
  flex-wrap: wrap;
}
.btn {
  padding: 2px 8px;
}
.divider {
  width: 1px;
  height: 16px;
  background: var(--vsc-border);
}
.check-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--vsc-fg-muted);
}
.more {
  position: relative;
}
.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 140px;
  background: var(--vsc-bg-elevated);
  border: 1px solid var(--vsc-border-weak);
  border-radius: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 20;
  padding: 4px 0;
}
.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--vsc-fg);
}
.dropdown-item:hover:not(:disabled) {
  background: var(--vsc-info-bg);
}
.dropdown-item:disabled {
  color: var(--vsc-fg-muted);
  cursor: not-allowed;
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
  width: 150px;
}
.badge {
  background: var(--vsc-border-weak);
  border-radius: 2px;
  padding: 0 6px;
  font-size: 12px;
}
.region {
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
</style>