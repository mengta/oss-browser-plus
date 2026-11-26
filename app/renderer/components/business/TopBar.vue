<template>
  <nav class="navbar navbar-default navbar-fixed-top navbar-inverse my-nav" data-testid="topbar">
    <div class="navbar-header">
      <a class="navbar-brand" href="javascript:void(0)" data-testid="topbar-brand" @click="openModal('about')">
        <img v-if="logo" :src="logo" width="18" class="brand-logo" alt="" />
        {{ appName }}
      </a>
      <label class="app-version" data-testid="topbar-version" @click="openModal('about')">v{{ version }}</label>
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
import { useAuthStore } from '../../stores/auth.js';
import { useBootstrapStore } from '../../stores/bootstrap.js';
import { useFilesStore } from '../../stores/files.js';
import { useUiStore } from '../../stores/ui.js';
import { formatDateTime } from '../../services/formatters.js';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const bootstrapStore = useBootstrapStore();
const filesStore = useFilesStore();
const ui = useUiStore();


const snapshot = computed(() => bootstrapStore.snapshot || {});
const appName = computed(() => t('app.name'));
const version = computed(() => snapshot.value.appVersion || '');
const logo = computed(() => snapshot.value.logo || '');
const authInfo = computed(() => authStore.info || {});
const loggedIn = computed(() => authStore.isLoggedIn);
const isSts = computed(() => String(authInfo.value.id || '').indexOf('STS.') === 0);
const isFilesPage = computed(() => route.path === '/');

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

async function logout() {
  const confirmed = await ui.confirm(t('logout'), t('logout.message'), {
    okText: t('ok'),
    cancelText: t('cancel'),
    cls: 'primary',
  });
  if (!confirmed) return;
  authStore.remove();
  filesStore.reset();
  router.push('/login').catch(() => {});
}
</script>

<style scoped>
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
.app-version {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  margin-left: 6px;
  font-size: 11px;
  cursor: pointer;
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
.navbar-form {
  margin: 3px 8px 0 0;
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
  min-height: 50px;
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
.app-version {
  display: inline-block;
  margin-left: 8px;
  color: var(--vsc-fg-muted);
  font-size: 12px;
  cursor: pointer;
  font-weight: normal;
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
  background: #080808;
}
.mini-link {
  color: var(--vsc-border);
  font-weight: bold;
  margin-right: 10px;
  text-decoration: none;
}
</style>