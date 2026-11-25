<template>
  <div class="file-toolbar" data-testid="file-toolbar">
    <button type="button" class="btn btn-default" data-testid="file-upload" :disabled="readOnly" @click="emit('upload', false)">
      {{ isMac ? t('upload') : t('upload') }}
    </button>
    <button v-if="!isMac" type="button" class="btn btn-default" data-testid="file-upload-folder" :disabled="readOnly" @click="emit('upload', true)">
      {{ t('files') }}
    </button>
    <button type="button" class="btn btn-default" data-testid="file-mkdir" :disabled="readOnly" @click="emit('mkdir')">
      {{ t('folder.create') }}
    </button>
    <span class="divider" />
    <label class="check-all">
      <input type="checkbox" :checked="filesStore.selectedAll" :disabled="filesStore.items.length === 0" data-testid="toolbar-check-all" @change="filesStore.selectAll()" />
      {{ t('select.all') }}
    </label>
    <button type="button" class="btn btn-default" data-testid="file-download" :disabled="!selHas" @click="emit('download', filesStore.selectedList)">
      {{ t('download') }}
    </button>
    <button type="button" class="btn btn-default" data-testid="file-copy" :disabled="!selHas || readOnly" @click="emit('copy', filesStore.selectedList)">
      {{ t('copy') }}
    </button>

    <!-- 更多下拉（等价 file-toolbar.html:106-242） -->
    <div class="more" data-testid="file-more">
      <button type="button" class="btn btn-default" :disabled="!selHas" @click="showMore = !showMore">
        {{ t('more') }} ▾
      </button>
      <div v-if="showMore" class="dropdown">
        <button type="button" class="dropdown-item" data-testid="more-move" :disabled="!selHas || readOnly" @click="fire('move')">
          {{ t('move') }}
        </button>
        <button
          type="button"
          class="dropdown-item"
          data-testid="more-rename"
          :disabled="!canRename"
          @click="fire('rename')"
        >
          {{ t('rename') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-acl" :disabled="!canAcl" @click="showAcl">
          {{ t('acl') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-grant" :disabled="!selHas || isSts" @click="fire('grant')">
          {{ t('simplePolicy') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-grant-token" :disabled="!canGrantToken" @click="fire('grant-token')">
          {{ t('genAuthToken') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-address" :disabled="!canAddress" @click="fire('address')">
          {{ t('getAddress') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-http-headers" :disabled="!canHeaders" @click="showHeaders">
          {{ t('http.headers') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-restore" :disabled="!selHas || !canRestoreAny" @click="fire('restore')">
          {{ t('restore') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-symlink" :disabled="!canSymlink" @click="fire('symlink')">
          {{ t('file.op.set_symlink') }}
        </button>
        <button type="button" class="dropdown-item" data-testid="more-delete" :disabled="!selHas || readOnly" @click="fire('delete')">
          {{ t('delete') }}
        </button>
      </div>
    </div>

    <!-- 粘贴组（等价 file-toolbar.html:244-271，keepMoveOptions 存在时显示） -->
    <template v-if="pastePending">
      <button type="button" class="btn btn-default" data-testid="file-paste" @click="emit('paste')">{{ t('paste') }}</button>
      <button type="button" class="btn btn-default" data-testid="file-paste-cancel" @click="emit('cancel-paste')">{{ t('copy.cancel') }}</button>
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
import { useFilesStore } from '../../../stores/files.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useBootstrapStore } from '../../../stores/bootstrap.js';
import { useUiStore } from '../../../stores/ui.js';

const props = defineProps({
  pastePending: { type: Boolean, default: false },
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
.file-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e5e5;
  flex-wrap: wrap;
}
.btn {
  padding: 3px 10px;
}
.divider {
  width: 1px;
  height: 18px;
  background: #e0e0e0;
}
.check-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #555;
}
.more {
  position: relative;
}
.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 140px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
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
  color: #333;
}
.dropdown-item:hover:not(:disabled) {
  background: #f0f6ff;
}
.dropdown-item:disabled {
  color: #bbb;
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
  background: #f0f0f0;
  border-radius: 8px;
  padding: 0 6px;
  font-size: 12px;
}
.region {
  font-size: 12px;
  color: #888;
}
</style>