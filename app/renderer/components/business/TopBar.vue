<template>
  <nav
    class="navbar navbar-default navbar-fixed-top navbar-inverse my-nav"
    :class="{ 'is-mac': isMac }"
    data-testid="topbar"
    @dblclick="onTitlebarDblClick"
  >
    <div class="navbar-header">
      <a class="navbar-brand" href="javascript:void(0)" data-testid="topbar-brand" :title="appName" @click="openModal('about')">
        <img v-if="logo" :src="logo" width="18" class="brand-logo" alt="" />
      </a>

    </div>

    <div v-if="loggedIn" class="collapse navbar-collapse" data-testid="topbar-nav">
      <ul class="nav navbar-nav">
        <li :class="{ active: isFilesPage }">
          <router-link to="/" data-testid="topbar-files"><AppIcon name="folder" class="tb-icon" /> {{ t('files') }}</router-link>
        </li>
      </ul>

      <ul class="nav navbar-nav navbar-right topbar-right">
        <li v-if="!isSts">
          <a href="javascript:void(0)" data-testid="topbar-users" @click="openModal('users')">
            <AppIcon name="users" class="tb-icon" /> {{ t('users') }}
          </a>
        </li>
        <li v-if="!isSts">
          <a href="javascript:void(0)" data-testid="topbar-fav" @click="openModal('fav-list')">
            <AppIcon name="star" class="tb-icon" /> {{ t('bookmarks') }}
          </a>
        </li>
        <li>
          <a href="javascript:void(0)" data-testid="topbar-settings" @click="openModal('settings')">
            <AppIcon name="cog" class="tb-icon" /> {{ t('settings') }}
          </a>
        </li>
        <li>
          <a href="javascript:void(0)" data-testid="topbar-about" @click="openModal('about')">
            <AppIcon name="info-circle" class="tb-icon" /> {{ t('about') }}
          </a>
        </li>
        <li>
          <HintTooltip
            v-if="authInfo.expiration"
            class="tb-temp"
            :text="validUntilTip"
            data-testid="topbar-temp-cert"
          >
            <AppIcon name="hourglass" class="tb-icon" /> {{ t('tempCert') }}: {{ t('auth.authToken.info.leftTime') }}: {{ remainingText }}
          </HintTooltip>
          <a v-else href="javascript:void(0)" data-testid="topbar-account">
            <AppIcon name="user" class="tb-icon" />
            <span v-if="authInfo.desc">{{ shortDesc }} ({{ idPrefix }}..)</span>
            <span v-else>{{ authInfo.id }}</span>
          </a>
        </li>
        <li>
          <a href="javascript:void(0)" data-testid="topbar-logout" @click="logout"><AppIcon name="power-off" class="tb-icon" /> {{ t('logout') }}</a>
        </li>
      </ul>
    </div>

    <form v-else class="navbar-form navbar-right" data-testid="topbar-mini">
      <div class="form-inline form-group">
        <a href="javascript:void(0)" class="mini-link" data-testid="topbar-settings" @click="openModal('settings')">
          <AppIcon name="cog" class="tb-icon" /> {{ t('settings') }}
        </a>
        <a href="javascript:void(0)" class="mini-link" data-testid="topbar-about" @click="openModal('about')">
          <AppIcon name="info-circle" class="tb-icon" /> {{ t('about') }}
        </a>
      </div>
    </form>

    <WindowControls />
  </nav>
</template>

<script setup>
// 等价 Angular 顶栏（app/main/_/top.html + top.js 的展示/入口语义，B4-01 提前落地）：
// 品牌/版本/文件入口/用户·收藏（非 STS）/设置/关于（升级角标位）/账号或临时凭证/退出；
// 未登录仅保留 设置/关于（语言切换在设置页）；不丢当前页状态（modal 打开不导航）。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../base/AppIcon.vue';
import HintTooltip from '../base/HintTooltip.vue';
import WindowControls from '../base/WindowControls.vue';
import { useAuthStore } from '../../stores/auth.js';
import { useBootstrapStore } from '../../stores/bootstrap.js';
import { useUiStore } from '../../stores/ui.js';
import { formatDateTime } from '../../services/formatters.js';
import { clearUserSession } from '../../services/session.js';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const bootstrapStore = useBootstrapStore();

const ui = useUiStore();


const snapshot = computed(() => bootstrapStore.snapshot || {});
const appName = computed(() => t('app.name'));

const logo = computed(() => snapshot.value.logo || '');
const authInfo = computed(() => authStore.info || {});
const loggedIn = computed(() => authStore.isLoggedIn);
const isSts = computed(() => String(authInfo.value.id || '').indexOf('STS.') === 0);
const isFilesPage = computed(() => route.path === '/');
const isMac = computed(() => snapshot.value.platform === 'darwin');

const shortDesc = computed(() => {
  const desc = String(authInfo.value.desc || '');
  return desc.length > 10 ? desc.slice(0, 10) : desc;
});
const idPrefix = computed(() => String(authInfo.value.id || '').substring(0, 3));
const expirationText = computed(() =>
  authInfo.value.expiration ? formatDateTime(authInfo.value.expiration) : ''
);
const validUntilTip = computed(() =>
  authInfo.value.expiration
    ? t('auth.authToken.info.validUntil', { expiration: expirationText.value })
    : ''
);

// 等价原版 my-timer：临时凭证剩余时间（HH:mm:ss）
const remainingText = ref('');
let remainingTimer = null;

function updateRemaining() {
  const raw = authInfo.value.expiration;
  const exp = raw ? new Date(raw).getTime() : 0;
  if (!exp || isNaN(exp)) {
    remainingText.value = '';
    return;
  }
  const left = Math.max(0, exp - Date.now());
  const total = Math.floor(left / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  remainingText.value =
    pad(Math.floor(total / 3600)) + ':' + pad(Math.floor((total % 3600) / 60)) + ':' + pad(total % 60);
}

onMounted(() => {
  updateRemaining();
  remainingTimer = setInterval(updateRemaining, 1000);
});

onBeforeUnmount(() => {
  if (remainingTimer) clearInterval(remainingTimer);
});

function openModal(name) {
  ui.open(name);
}

// 无边框标题栏：双击空白区切换最大化（MAC 保留系统交通灯行为）
async function onTitlebarDblClick(event) {
  if (isMac.value) return;
  const target = event && event.target;
  if (target && typeof target.closest === 'function' && target.closest('a, button, input, select, label, form')) {
    return;
  }
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (!system || typeof system.toggleMaximizeWindow !== 'function') return;
  try {
    await system.toggleMaximizeWindow();
  } catch (err) {
    /* 非 Electron 环境忽略 */
  }
}

async function logout() {
  const confirmed = await ui.confirm(t('logout'), t('logout.message'), {
    okText: t('ok'),
    cancelText: t('cancel'),
    cls: 'primary',
  });
  if (!confirmed) return;
  clearUserSession();
  router.push('/login').catch(() => {});
}
</script>

<style scoped>
/* 顶部导航：左右区域统一 35px 高并垂直居中 */
.my-nav {
  display: flex;
  align-items: center;
}
.navbar-header {
  flex: 0 0 auto;
}
.navbar-collapse {
  flex: 1 1 auto;
  display: flex !important;
  align-items: center;
  justify-content: flex-end;
  padding: 0 6px 0 0;
  border-top: none;
  box-shadow: none;
  max-height: none;
}
.navbar-nav {
  display: flex;
  align-items: center;
  float: none !important;
  margin: 0;
  padding-left: 0;
  list-style: none;
}
.navbar-nav > li {
  list-style: none;
}
.navbar-nav.navbar-right {
  float: none !important;
  margin-left: auto;
}
.navbar-nav > li {
  float: none;
}
.navbar-nav > li > a {
  height: var(--vsc-titlebar-h, 35px);
  padding: 0 10px !important;
}
.navbar-form {
  margin: 0;
  display: flex;
  align-items: center;
  height: var(--vsc-titlebar-h, 35px);
}
.tb-temp {
  height: var(--vsc-titlebar-h, 35px);
  padding: 0 10px;
}

/* VS Code 标题栏：35px 紧凑、图标 + 文本 */
.my-nav {
  min-height: var(--vsc-titlebar-h, 35px);
}
.navbar-brand {
  padding: 0 10px !important;
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.brand-logo {
  width: 18px;
  height: 18px;
}
.tb-temp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  color: var(--vsc-fg);
  font-size: 12px;
  cursor: default;
}
.tb-temp:hover {
  background: var(--vsc-bg-hover);
}
.navbar-header {
  display: flex;
  align-items: center;
  height: var(--vsc-titlebar-h, 35px);
  float: none;
}

.navbar-nav > li > a,
.navbar-nav > li > router-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px !important;
  font-size: 12px;
}
.tb-icon {
  width: 13px;
  height: 13px;
}

.mini-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.topbar-right {
  margin-right: 4px;
}
.my-nav {
  min-height: var(--vsc-titlebar-h, 35px);
  margin-bottom: 0;
  border-radius: 0;
}
.navbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--vsc-on-accent) !important;
}
.brand-logo {
  display: inline-block;
}
.tb-temp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  color: var(--vsc-fg);
  font-size: 12px;
  cursor: default;
}
.tb-temp:hover {
  background: var(--vsc-bg-hover);
}

.topbar-right {
  margin-right: 10px;
}
.topbar-right a,
.navbar-nav a {
  color: var(--vsc-border-weak);
  cursor: pointer;
}
.navbar-nav > li.active > a {
  color: var(--vsc-on-accent);
  background: var(--vsc-bg);
}
.mini-link {
  color: var(--vsc-border);

  text-decoration: none;
}

/* VS Code 无边框标题栏：整条顶栏可拖动窗口，交互元素排除 */
.my-nav {
  -webkit-app-region: drag;
  app-region: drag;
  user-select: none;
}
.my-nav a,
.my-nav button,
.my-nav input,
.my-nav select,
.my-nav label,
.my-nav form,
.my-nav li,
.my-nav .window-controls {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
.my-nav.is-mac {
  padding-left: 74px;
}
.navbar-form.navbar-right {
  margin: 0 8px 0 auto;
  padding: 0 8px;
  height: var(--vsc-titlebar-h, 35px);
}
.navbar-form .form-inline.form-group {
  margin: 0;
}
.navbar-form .mini-link {
  height: calc(var(--vsc-titlebar-h, 35px) - 7px);
  padding: 0 8px;
  border-radius: 2px;
}
</style>