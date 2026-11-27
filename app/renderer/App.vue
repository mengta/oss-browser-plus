<template>
  <div class="vue-app-shell">
    <TopBar />
    <div v-if="portNotice" class="vue-port-notice" role="alert" data-testid="port-unavailable-notice">{{ portNotice }}</div>
    <main class="vue-app-main" data-testid="vue-app-main">
      <div v-if="loading" class="vue-boot-loading" role="status" aria-live="polite">
        <span class="vue-boot-spinner"></span>
      </div>
      <ErrorBoundary v-else :key="boundaryKey" @retry="onBoundaryRetry">
        <router-view />
      </ErrorBoundary>
    </main>
    <ModalHost />
    <ToastHost />
    <StatusBar />
    <CommandPalette :commands="commands" />
    <ThemePicker />
  </div>
</template>

<script setup>
// B4-02/B4-03/B4-06：壳组装（TopBar + RouterView + ToastHost + ModalHost）、
// 启动链（bootstrap.get → i18n → portReady 1.5s 门 → 隐藏 loading → #app-ready）、错误边界、升级启动检测。
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { init } from './bootstrap.js';
import { portReady } from './services/api.js';
import { reportError } from './services/renderer-log.js';
import { useUiStore, disposeSystemTheme } from './stores/ui.js';
import { useSettingsStore } from './stores/settings.js';
import TopBar from './components/business/TopBar.vue';
import ModalHost from './components/base/ModalHost.vue';
import ToastHost from './components/base/ToastHost.vue';
import StatusBar from './components/base/StatusBar.vue';
import ErrorBoundary from './components/base/ErrorBoundary.vue';

import CommandPalette from './components/base/CommandPalette.vue';
import ThemePicker from './components/base/ThemePicker.vue';
import { useAuthStore } from './stores/auth.js';
import { useFilesStore } from './stores/files.js';
import { useTransferStore } from './stores/transfer.js';
import { clearUserSession } from './services/session.js';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const filesStore = useFilesStore();
const transferStore = useTransferStore();
const ui = useUiStore();
const loading = ref(true);
// P4（R-P4-01）：静态服务端口不可用时的可见提示（不使用默认端口）
const portNotice = ref('');
const bootError = ref(null);
const boundaryKey = ref(0);
const loggedIn = computed(() => authStore.isLoggedIn);

try {
  const storedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('vsc-theme')) || 'dark';
  ui.setTheme(storedTheme);
} catch (err) {
  ui.setTheme('dark');
}

// VS Code 命令面板（Ctrl+Shift+P / F1）：常用动作
const commands = computed(() => {
  if (!authStore.isLoggedIn) return [];
  const info = () => ({ region: filesStore.region, bucket: filesStore.bucket, key: filesStore.prefix });
  return [
    { id: 'refresh', label: '刷新列表', icon: 'refresh', run: () => filesStore.loadObjects(true) },
    { id: 'mkdir', label: '新建目录', icon: 'plus', run: () => ui.open('add-folder', { currentInfo: info() }) },
    ...(filesStore.selectedList.length === 1
      ? [{ id: 'rename-selected', label: '重命名', icon: 'edit', run: () => ui.open('rename', { item: filesStore.selectedList[0], moveTo: info(), currentInfo: info(), isCopy: false }) }]
      : []),
    ...(filesStore.selectedList.length > 0
      ? [{ id: 'delete-selected', label: '删除所选', icon: 'trash', run: () => ui.open('delete-files', { items: filesStore.selectedList.slice(), currentInfo: info() }) }]
      : []),
    { id: 'upload', label: '上传文件', icon: 'cloud-upload', run: () => { const el = document.querySelector('[data-testid="file-upload"]'); if (el) el.click(); } },
    { id: 'download', label: '下载所选', icon: 'download', run: () => { const el = document.querySelector('[data-testid="file-download"]'); if (el) el.click(); } },
    { id: 'search', label: '搜索文件', icon: 'search', run: () => { const el = document.querySelector('[data-testid="file-search"]'); if (el) el.focus(); } },
    { id: 'view-list', label: '切换为列表视图', icon: 'file', run: () => { filesStore.viewMode = 'list'; } },
    { id: 'view-blocks', label: '切换为块状视图', icon: 'square', run: () => { filesStore.viewMode = 'blocks'; } },
    { id: 'users', label: t('users'), icon: 'users', run: () => ui.open('users') },
    { id: 'fav', label: t('bookmarks'), icon: 'star', run: () => ui.open('fav-list') },
    { id: 'settings', label: t('settings'), icon: 'cog', run: () => ui.open('settings') },
    { id: 'about', label: t('about'), icon: 'info-circle', run: () => ui.open('about') },
    { id: 'theme-pick', label: t('theme.picker.title'), icon: ui.themeMode === 'light' ? 'sun' : 'moon', shortcut: 'Ctrl+K Ctrl+T', run: () => ui.openThemePicker() },
    { id: 'theme-toggle', label: ui.themeMode === 'dark' ? '切换为浅色主题' : ui.themeMode === 'light' ? '跟随系统主题' : '切换为深色主题', icon: ui.themeMode === 'dark' ? 'sun' : ui.themeMode === 'light' ? 'monitor' : 'moon', run: () => ui.setTheme(ui.themeMode === 'dark' ? 'light' : ui.themeMode === 'light' ? 'system' : 'dark') },
    { id: 'theme-system', label: '主题：跟随系统', icon: 'monitor', run: () => ui.setTheme('system') },
    { id: 'transfer-open', label: '打开传输中心', icon: 'cloud-upload', run: () => transferStore.setVisible(true, 'upload') },
    { id: 'transfer-pause', label: '暂停全部传输', icon: 'hourglass', run: () => { [...transferStore.uploads, ...transferStore.downloads].filter((x) => ['running', 'waiting', 'verifying', 'retrying'].indexOf(x.status) !== -1).forEach((x) => transferStore.pause(x.taskId)); } },
    { id: 'transfer-resume', label: '恢复全部传输', icon: 'refresh', run: () => { [...transferStore.uploads, ...transferStore.downloads].filter((x) => x.status === 'paused' || x.status === 'stopped').forEach((x) => transferStore.resume(x.taskId)); } },
    { id: 'transfer-stop', label: '停止全部传输', icon: 'close', run: () => { transferStore.stopAll('upload'); transferStore.stopAll('download'); } },
    { id: 'transfer-clear', label: '清除已完成传输', icon: 'trash', run: () => { transferStore.clearCompleted('upload'); transferStore.clearCompleted('download'); } },
    { id: 'logout', label: t('logout'), icon: 'power-off', run: () => { clearUserSession(); router.push('/login').catch(() => {}); } },
  ];
});

function onBoundaryRetry() {
  boundaryKey.value += 1;
}

onMounted(async () => {
  try {
    await init();
  } catch (err) {
    bootError.value = err;
  }

  // 静态服务端口就绪门：1.5s 未就绪不阻塞主功能（FlvPlayer 等按需再取）
  try {
    await portReady();
  } catch (err) {
    /* 端口未就绪：业务请求在需要时重试，不白屏；同时给出可见提示（不静默） */
    portNotice.value = t('preview.serviceUnavailable');
    reportError('port-unavailable', err);
  }

  // 传输中心：订阅 transfer:progress 并恢复历史任务，否则上传/下载进度与状态不更新
  try {
    await transferStore.init();
  } catch (err) {
    /* 传输初始化失败不阻断主功能 */
  }

  // 启动初始化 settings（触发 mailSender 等凭证惰性迁移；自动更新已移除）
  try {
    useSettingsStore();
  } catch (err) {
    /* 存储不可用不阻塞启动 */
  }

  loading.value = false;
  document.body.classList.add('app-ready');
  if (!document.getElementById('app-ready')) {
    const marker = document.createElement('div');
    marker.id = 'app-ready';
    marker.style.display = 'none';
    document.body.appendChild(marker);
  }

});

// P7a（R-P7-05）：卸载时解绑系统主题监听与传输广播订阅，避免重复回调
onBeforeUnmount(() => {
  disposeSystemTheme();
  try {
    transferStore.dispose();
  } catch (err) {}
});

void bootError;
</script>

<style scoped>
.vue-app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.vue-app-shell :deep(.my-nav) {
  flex: 0 0 auto;
}
.vue-app-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 var(--vsc-statusbar-h, 22px);
}

.vue-port-notice {
  margin: 0 8px;
  padding: 6px 10px;
  border: 1px solid var(--vsc-warning);
  border-radius: 2px;
  color: var(--vsc-warning);
  background: var(--vsc-bg-elevated);
  font-size: 12px;
}
.vue-boot-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
}
.vue-boot-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--vsc-border);
  border-top-color: var(--vsc-fg-muted);
  border-radius: 50%;
  animation: vue-boot-spin 0.8s linear infinite;
}
@keyframes vue-boot-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>