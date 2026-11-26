<template>
  <aside class="activity-bar" data-testid="activity-bar">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="ab-item"
      :class="{ active: item.active }"
      :title="item.title"
      :data-testid="'activity-' + item.key"
      @click="run(item)"
    >
      <AppIcon :name="item.icon" />
    </button>
    <div class="ab-spacer" />
    <button type="button" class="ab-item" :title="themeMode === 'dark' ? '切换为浅色主题' : themeMode === 'light' ? '跟随系统主题' : '切换为深色主题'" data-testid="activity-theme" @click="toggleTheme">
      <AppIcon :name="themeMode === 'dark' ? 'sun' : themeMode === 'light' ? 'monitor' : 'moon'" />
    </button>
    <button type="button" class="ab-item" :title="t('about')" data-testid="activity-about" @click="openModal('about')">
      <AppIcon name="info-circle" />
    </button>
  </aside>
</template>

<script setup>
// VS Code 活动栏（44px，图标 + hover 高亮 + 左侧激活条）；仅登录态由 App 挂载。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../base/AppIcon.vue';
import { useUiStore } from '../../stores/ui.js';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const themeMode = computed(() => ui.themeMode);

function toggleTheme() {
  const next = ui.themeMode === 'dark' ? 'light' : ui.themeMode === 'light' ? 'system' : 'dark';
  ui.setTheme(next);
}

const items = computed(() => [
  { key: 'files', title: t('files'), icon: 'folder', active: route.path === '/', run: () => router.push('/').catch(() => {}) },
  { key: 'users', title: t('users'), icon: 'users', run: () => ui.open('users') },
  { key: 'fav', title: t('bookmarks'), icon: 'star', run: () => ui.open('fav-list') },
  { key: 'settings', title: t('settings'), icon: 'cog', run: () => ui.open('settings') },
]);

function run(item) {
  item.run();
}

function openModal(name) {
  ui.open(name);
}
</script>

<style scoped>
.activity-bar {
  position: fixed;
  left: 0;
  top: 35px;
  bottom: 22px;
  width: 44px;
  background: var(--vsc-activity-bg);
  border-right: 1px solid var(--vsc-activity-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6px;
  z-index: 1020;
}
.ab-item {
  width: 44px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--vsc-activity-fg);
  cursor: pointer;
  position: relative;
}
.ab-item :deep(svg) {
  width: 20px;
  height: 20px;
}
.ab-item:hover,
.ab-item.active {
  color: var(--vsc-activity-fg-active);
}
.ab-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--vsc-accent);
}
.ab-spacer {
  flex: 1;
}
</style>