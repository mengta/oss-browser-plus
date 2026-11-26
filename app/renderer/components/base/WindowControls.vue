<template>
  <div v-if="visible" class="window-controls" data-testid="window-controls">
    <button
      type="button"
      class="wc-btn"
      data-testid="window-minimize"
      :title="t('window.minimize')"
      :aria-label="t('window.minimize')"
      @click="minimize"
    >
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h8" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
    </button>
    <button
      type="button"
      class="wc-btn"
      data-testid="window-maximize"
      :title="maximized ? t('window.restore') : t('window.maximize')"
      :aria-label="maximized ? t('window.restore') : t('window.maximize')"
      @click="toggleMaximize"
    >
      <svg v-if="maximized" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.5" y="3.5" width="5.5" height="5.5" stroke="currentColor" stroke-width="1" fill="none" />
        <path d="M3.5 3.5V1.5h5v5h-2" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
      <svg v-else viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
    </button>
    <button
      type="button"
      class="wc-btn wc-close"
      data-testid="window-close"
      :title="t('window.close')"
      :aria-label="t('window.close')"
      @click="closeWindow"
    >
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
    </button>
  </div>
</template>

<script setup>
// VS Code 风格自绘标题栏按钮（Windows/Linux）；macOS 保留系统交通灯。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBootstrapStore } from '../../stores/bootstrap.js';

const { t } = useI18n();
const bootstrapStore = useBootstrapStore();

const platform = computed(() => (bootstrapStore.snapshot && bootstrapStore.snapshot.platform) || 'win32');
const visible = computed(() => platform.value !== 'darwin');
const maximized = ref(false);

function systemApi() {
  return typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
}

async function call(method, ...args) {
  const system = systemApi();
  if (!system || typeof system[method] !== 'function') return null;
  try {
    const res = await system[method](...args);
    return res && res.ok ? res.data : null;
  } catch (err) {
    return null;
  }
}

async function refreshMaximized() {
  const value = await call('isWindowMaximized');
  if (typeof value === 'boolean') maximized.value = value;
}

let subscriptionId = null;

onMounted(async () => {
  await refreshMaximized();
  try {
    const system = systemApi();
    if (!system || typeof system.subscribeWindowState !== 'function') return;
    const res = await system.subscribeWindowState((value) => {
      maximized.value = Boolean(value);
    });
    subscriptionId = res && res.ok ? res.data : null;
  } catch (err) {
    subscriptionId = null;
  }
});

onBeforeUnmount(() => {
  if (subscriptionId == null) return;
  const system = systemApi();
  if (!system || typeof system.unsubscribeWindowState !== 'function') return;
  try {
    system.unsubscribeWindowState(subscriptionId);
  } catch (err) {
    // 窗口销毁阶段调用失败可忽略
  }
});

async function minimize() {
  await call('minimizeWindow');
}

async function toggleMaximize() {
  const value = await call('toggleMaximizeWindow');
  if (typeof value === 'boolean') maximized.value = value;
}

async function closeWindow() {
  await call('closeWindow');
}
</script>

<style scoped>
.window-controls {
  flex: 0 0 auto;
  display: flex;
  align-items: stretch;
  height: var(--vsc-titlebar-h, 35px);
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
.wc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--vsc-fg-muted);
  cursor: default;
  outline: none;
}
.wc-btn svg {
  width: 10px;
  height: 10px;
}
.wc-btn:hover {
  background: var(--vsc-bg-hover, rgba(255, 255, 255, 0.1));
  color: var(--vsc-fg);
}
.wc-close:hover {
  background: #e81123;
  color: #ffffff;
}
</style>