<template>
  <div class="login-page" data-testid="vue-login-page">
    <aside class="login-brand" data-testid="login-brand">
      <div class="lb-main">
        <div class="lb-brand-row">
          <img v-if="logo" :src="logo" class="lb-logo" alt="" data-testid="login-brand-logo" />
          <div>
            <h1 class="lb-title" data-testid="login-brand-name">{{ t('app.name') }}</h1>
            <p class="lb-subtitle">{{ t('login.brand.subtitle') }}</p>
          </div>
        </div>

        <ul class="lb-features">
          <li class="lb-feature" data-testid="login-feature">
            <span class="lb-feature-icon"><AppIcon name="database" /></span>
            <div>
              <strong>{{ t('login.feature.multiCloud') }}</strong>
              <small>{{ t('login.feature.multiCloudDesc') }}</small>
            </div>
          </li>
          <li class="lb-feature" data-testid="login-feature">
            <span class="lb-feature-icon"><AppIcon name="shield" /></span>
            <div>
              <strong>{{ t('login.feature.secureCredential') }}</strong>
              <small>{{ t('login.feature.secureCredentialDesc') }}</small>
            </div>
          </li>
          <li class="lb-feature" data-testid="login-feature">
            <span class="lb-feature-icon"><AppIcon name="cloud-upload" /></span>
            <div>
              <strong>{{ t('login.feature.batchOps') }}</strong>
              <small>{{ t('login.feature.batchOpsDesc') }}</small>
            </div>
          </li>
        </ul>
      </div>

      <div class="lb-footer">
        <div class="lb-status" data-testid="login-status">
          <span class="lb-dot" />
          {{ t('login.status.disconnected') }}
        </div>
        <p class="lb-note">{{ t('login.securityNote') }}</p>
      </div>
    </aside>

    <section class="login-panel" data-testid="login-panel">
      <div class="login-card">
        <header class="login-card-head">
          <h2 class="login-card-title" data-testid="login-form-title">{{ t('login.form.title') }}</h2>
          <div class="login-provider" data-testid="login-provider">
            <span class="lp-label">{{ t('login.provider') }}</span>
            <span class="lp-value">
              <AppIcon name="cloud-upload" class="lp-icon" />
              {{ t('login.provider.aliyun') }}
            </span>
          </div>
        </header>

        <div class="login-tabs" role="tablist" :aria-label="t('login.mode')">
          <button
            type="button"
            class="login-tab"
            :class="{ active: loginMode === 'ak' }"
            role="tab"
            :aria-selected="loginMode === 'ak'"
            data-testid="login-tab-ak"
            @click="loginMode = 'ak'"
          >
            <span class="lt-title"><AppIcon name="user" class="lt-icon" />{{ t('auth.akLogin') }}</span>
            <span class="lt-desc">{{ t('login.mode.akDesc') }}</span>
          </button>
          <button
            type="button"
            class="login-tab"
            :class="{ active: loginMode === 'token' }"
            role="tab"
            :aria-selected="loginMode === 'token'"
            data-testid="login-tab-token"
            @click="loginMode = 'token'"
          >
            <span class="lt-title"><AppIcon name="user-secret" class="lt-icon" />{{ t('auth.tokenLogin') }}</span>
            <span class="lt-desc">{{ t('login.mode.tokenDesc') }}</span>
          </button>
        </div>

        <CredentialForm
          v-if="loginMode === 'ak'"
          ref="credentialForm"
          v-model="item"
          :endpoint-type="eptplType"
          :remember="remember"
          :keep-logged-in="keepLoggedIn"
          :secure="secure"
          @update:endpoint-type="eptplType = $event"
          @update:remember="remember = $event"
          @update:keep-logged-in="keepLoggedIn = $event"
          @update:secure="secure = $event"
          @submit="onSubmit"
        >
          <template #footer>
            <div class="login-actions">
              <button
                type="button"
                class="login-submit"
                :disabled="loading"
                data-testid="login-submit"
                @click="onSubmit"
              >
                {{ loading ? t('logining') : t('auth.login') }}
              </button>
              <button
                type="button"
                class="login-btn"
                data-testid="login-histories"
                @click="historiesOpen = true"
              >
                {{ t('auth.akHistories') }}
                <span v-if="auth.histories.length" class="login-badge">{{ auth.histories.length }}</span>
              </button>
              <button
                type="button"
                class="login-btn login-btn-import"
                data-testid="login-import"
                @click="importOpen = true"
              >
                {{ t('auth.importConfig') }}
              </button>
            </div>
          </template>
        </CredentialForm>

        <AuthTokenForm
          v-else
          :model-value="authToken"
          :info="authTokenInfo"
          @update:model-value="onAuthTokenInput"
          @submit="onTokenSubmit"
        />
      </div>
    </section>

    <BaseModal
      v-if="historiesOpen"
      :visible="true"
      :title="t('auth.akHistories')"
      @close="historiesOpen = false"
    >
      <AkHistoriesPanel @use="onUseHistory" @close="historiesOpen = false" />
    </BaseModal>

    <BaseModal
      v-if="importOpen"
      :visible="true"
      :title="t('auth.importConfig')"
      @close="importOpen = false"
    >
      <ImportConfigPanel @import="onImportConfig" @close="importOpen = false" />
    </BaseModal>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AppIcon from '../components/base/AppIcon.vue';
import CredentialForm from '../components/business/auth/CredentialForm.vue';
import AuthTokenForm from '../components/business/auth/AuthTokenForm.vue';
import AkHistoriesPanel from '../components/business/auth/AkHistoriesPanel.vue';
import ImportConfigPanel from '../components/business/auth/ImportConfigPanel.vue';
import BaseModal from '../components/base/BaseModal.vue';
import { useAuthStore } from '../stores/auth.js';
import { useBootstrapStore } from '../stores/bootstrap.js';
import { useToastStore } from '../stores/toast.js';
import { createAuthTokenWriter, decodeAuthToken } from '../services/auth-token.js';
import {
  KEY_REMEMBER,
  KEEP_ME_LOGGED_IN,
  PRIVATE_LINK,
  SHOW_REQUEST_PAY,
  SHOW_SECURE,
} from '../services/constants.js';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const bootstrapStore = useBootstrapStore();
const toast = useToastStore();

const logo = computed(() => {
  const snapshot = bootstrapStore.snapshot || {};
  return snapshot.logo || '';
});

// B1-18：登录页成为唯一入口后，启动即执行一次 load()，
// 以触发 auth-keep / auth-his 的惰性迁移（等价登录页初始化读取语义）。
auth.load();

const remembered = auth.getRemember() || {};
const item = reactive(Object.assign({}, remembered));
const eptplType = ref(remembered.eptplType || 'default');
delete item.eptplType;

const remember = ref(localStorage.getItem(KEY_REMEMBER) === 'YES');
// 等价原 flags.keepLoggedIn / flags.secure（$watch 实时持久化）
const keepLoggedIn = ref((localStorage.getItem(KEEP_ME_LOGGED_IN) || 'YES') === 'YES');
watch(keepLoggedIn, (v) => localStorage.setItem(KEEP_ME_LOGGED_IN, v ? 'YES' : 'NO'));
const secure = ref(localStorage.getItem(SHOW_SECURE) || 'YES');
const credentialForm = ref(null);
const loading = ref(false);

// AK 历史 / 一键导入弹窗（等价原 loginCtrl 的 showHistories / showImportConfig）
const historiesOpen = ref(false);
const importOpen = ref(false);

function onUseHistory(h) {
  if (h && h.cname) {
    eptplType.value = 'cname';
  }
  Object.assign(item, h);
  item.desc = (h && h.desc) || '';
  if (credentialForm.value) {
    credentialForm.value.applyExternal(item);
  }
  historiesOpen.value = false;
}

function onImportConfig(cfg) {
  const next = Object.assign({}, cfg);
  if (next.eptpl) {
    eptplType.value = 'customize';
    item.eptpl = next.eptpl;
    delete next.eptpl;
  }
  Object.assign(item, next);
  if (credentialForm.value) {
    credentialForm.value.applyExternal(item);
  }
  importOpen.value = false;
}

// 授权码登录态（原 Angular loginCtrl 的 item.authToken / authTokenInfo 语义）
// gtab 持久化等价原 $scope.$watch('gtab')：localStorage 'gtag'，'1'=AK登录 '2'=授权码
const loginMode = ref(localStorage.getItem('gtab') === '2' ? 'token' : 'ak');
watch(loginMode, (v) => localStorage.setItem('gtab', v === 'token' ? '2' : '1'));
const authToken = ref(auth.authToken || '');
const authTokenInfo = ref(authToken.value ? decodeAuthToken(authToken.value) : null);
const tokenWriter = createAuthTokenWriter();

function onAuthTokenInput(value) {
  authToken.value = value || '';
  tokenWriter.schedule(authToken.value);
  authTokenInfo.value = decodeAuthToken(authToken.value);
}

async function onTokenSubmit() {
  if (!authTokenInfo.value || loading.value) {
    return;
  }
  loading.value = true;
  localStorage.removeItem(PRIVATE_LINK);
  toast.push(t('logining'), 'info', 1000);
  try {
    const tokenPayload = Object.assign({}, authTokenInfo.value);
    tokenPayload.requestpaystatus = localStorage.getItem(SHOW_REQUEST_PAY) || 'NO';
    await auth.login(tokenPayload);
    toast.push(t('login.successfully'), 'success', 1000);
    await router.replace('/');
    goToFilesPage();
  } catch (err) {
    const code = (err && err.code) || (auth.lastError && auth.lastError.code) || 'Error';
    const message = (err && err.message) || (auth.lastError && auth.lastError.message) || '';
    toast.push(code + ':' + message, 'danger', 3000);
  } finally {
    loading.value = false;
  }
}

function normalizePayload() {
  const data = Object.assign({}, item);
  delete data.osspath_isdir;
  delete data.requestpaystatus;
  data.osspath = data.osspath || '';
  if (data.secret) {
    data.secret = String(data.secret).trim();
  }
  data.secure = localStorage.getItem(SHOW_SECURE) || 'YES';
  data.requestpaystatus = localStorage.getItem(SHOW_REQUEST_PAY) || 'NO';
  delete data.authToken;
  delete data.securityToken;
  if (String(data.id || '').indexOf('STS.') !== 0) {
    delete data.stoken;
  }
  return data;
}

// B1-18：登录成功后凭证已落盘，切回 Angular 文件页（#vue-app 随 state 切走而隐藏）。
function goToFilesPage() {
  if (typeof window === 'undefined' || !window.location) {
    return;
  }
  const ua = (window.navigator && window.navigator.userAgent) || '';
  if (ua.indexOf('jsdom') !== -1) {
    return;
  }
  window.location.hash = '#!/';
  window.location.reload();
}

async function onSubmit() {
  if (loading.value) {
    return;
  }
  // 等价原 form1.$valid 校验（必填/协议前缀/oss:// 前缀/区域必选）
  if (credentialForm.value && credentialForm.value.validate() === false) {
    return;
  }
  loading.value = true;
  localStorage.setItem(KEY_REMEMBER, remember.value ? 'YES' : 'NO');
  if (eptplType.value === 'privateLink') {
    localStorage.setItem(PRIVATE_LINK, item.privateLink || '');
  } else {
    localStorage.removeItem(PRIVATE_LINK);
  }

  const data = normalizePayload();
  toast.push(t('logining'), 'info', 1000);

  try {
    await auth.login(data, { remember: remember.value });
    // 等价原登录成功回调：非 {region} 模板端点时从 eptpl 提取 region 回写
    if (!data.region && String(data.eptpl || '').indexOf('{region}') === -1) {
      const matched = String(data.eptpl || '').match(/https?:\/\/(\S*)\.aliyuncs\.com/);
      if (matched) {
        data.region = matched[1].replace('-internal', '');
        auth.saveToAuthInfo({ region: data.region });
      }
    }
    toast.push(t('login.successfully'), 'success', 1000);
    await router.replace('/');
    goToFilesPage();
  } catch (err) {
    const code = (err && err.code) || (auth.lastError && auth.lastError.code) || 'Error';
    const message = (err && err.message) || (auth.lastError && auth.lastError.message) || '';
    toast.push(code + ':' + message, 'danger', 3000);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: stretch;
  min-height: calc(100vh - var(--vsc-titlebar-h, 35px));
  max-width: none;
  margin: 0;
  padding: 0;
}

/* 左侧品牌区：产品名、简介、能力特性与连接状态 */
.login-brand {
  flex: 0 0 42%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  padding: 48px 40px;
  background:
    linear-gradient(160deg, rgba(0, 122, 204, 0.16), transparent 58%),
    var(--vsc-bg);
  border-right: 1px solid var(--vsc-border);
}
.lb-main {
  width: 100%;
  max-width: 340px;
  margin: auto;
}
.lb-brand-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.lb-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
}
.lb-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--vsc-fg);
}
.lb-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--vsc-fg-muted);
}
.lb-features {
  list-style: none;
  margin: 34px 0 0;
  padding: 0;
  display: grid;
  gap: 16px;
}
.lb-feature {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.lb-feature-icon {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 122, 204, 0.16);
  color: var(--vsc-accent);
}
.lb-feature-icon :deep(svg) {
  width: 15px;
  height: 15px;
}
.lb-feature strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--vsc-fg);
}
.lb-feature small {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vsc-fg-muted);
}
.lb-footer {
  margin-top: 32px;
  padding-top: 18px;
  border-top: 1px solid var(--vsc-border-weak);
  width: 100%;
  max-width: 340px;
  margin-left: auto;
  margin-right: auto;
}
.lb-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
.lb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vsc-fg-dim);
}
.lb-note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--vsc-fg-dim);
}

/* 右侧表单区：卡片居中，填满剩余空间 */
.login-panel {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  overflow-y: auto;
  background: var(--vsc-bg-elevated);
}
.login-card {
  width: 100%;
  max-width: 470px;
  padding: 24px;
  background: var(--vsc-bg);
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}
.login-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.login-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--vsc-fg);
}
.login-provider {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
.lp-label {
  color: var(--vsc-fg-dim);
}
.lp-value {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  color: var(--vsc-fg);
}
.lp-icon {
  width: 12px;
  height: 12px;
  color: var(--vsc-accent);
}

/* 登录方式切换：两列卡片式 tab，标题 + 语义描述 */
.login-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.login-tab {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 12px;
  border: 1px solid var(--vsc-border);
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
  text-align: left;
}
.login-tab:hover {
  background: var(--vsc-bg-hover);
}
.login-tab.active {
  border-color: var(--vsc-accent);
  background: rgba(0, 122, 204, 0.2);
}
.login-tab.active .lt-desc {
  color: var(--vsc-fg);
}
.lt-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vsc-fg);
}
.lt-icon {
  width: 13px;
  height: 13px;
  color: var(--vsc-accent);
}
.lt-desc {
  font-size: 11px;
  color: var(--vsc-fg-muted);
}

.login-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-left: 0;
  margin-top: 2px;
}
.login-submit {
  flex: 1 1 100%;
  padding: 7px 24px;
  border: 1px solid var(--vsc-accent);
  background: var(--vsc-accent);
  color: var(--vsc-on-accent);
  border-radius: 2px;
  cursor: pointer;
}
.login-submit[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.login-btn {
  flex: 1 1 auto;
  margin-left: 0;
  padding: 6px 12px;
  border: 1px solid var(--vsc-border);
  background: var(--vsc-btn-bg);
  color: var(--vsc-btn-fg);
  border-radius: 2px;
  cursor: pointer;
}
.login-btn:hover {
  background: var(--vsc-btn-bg-hover);
}
.login-btn-import {
  border-color: var(--vsc-success);
  color: var(--vsc-success);
}
.login-badge {
  display: inline-block;
  min-width: 16px;
  padding: 1px 5px;
  margin-left: 4px;
  border-radius: 2px;
  background: var(--vsc-fg-dim);
  color: var(--vsc-on-accent);
  font-size: 11px;
  text-align: center;
}

/* 窄窗口：品牌区折叠为顶部条，隐藏特性与状态说明，表单全宽 */
@media (max-width: 900px) {
  .login-page {
    flex-direction: column;
  }
  .login-brand {
    flex: 0 0 auto;
    max-width: none;
    padding: 18px 24px;
    border-right: none;
    border-bottom: 1px solid var(--vsc-border);
  }
  .lb-main {
    margin: 0;
    max-width: none;
  }
  .lb-logo {
    width: 40px;
    height: 40px;
    border-radius: 8px;
  }
  .lb-title {
    font-size: 19px;
  }
  .lb-subtitle {
    margin-top: 2px;
  }
  .lb-features,
  .lb-footer {
    display: none;
  }
  .login-panel {
    padding: 20px 16px;
  }
  .login-card {
    padding: 18px;
  }
}
</style>