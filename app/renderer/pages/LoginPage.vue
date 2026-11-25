<template>
  <div class="login-page" data-testid="vue-login-page">
    <h2 class="login-title">{{ t('app.name') }}</h2>
    <div class="login-tabs">
      <button
        type="button"
        class="login-tab"
        :class="{ active: loginMode === 'ak' }"
        data-testid="login-tab-ak"
        @click="loginMode = 'ak'"
      >
        {{ t('auth.akLogin') }}
      </button>
      <button
        type="button"
        class="login-tab"
        :class="{ active: loginMode === 'token' }"
        data-testid="login-tab-token"
        @click="loginMode = 'token'"
      >
        {{ t('auth.tokenLogin') }}
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
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import CredentialForm from '../components/business/auth/CredentialForm.vue';
import AuthTokenForm from '../components/business/auth/AuthTokenForm.vue';
import AkHistoriesPanel from '../components/business/auth/AkHistoriesPanel.vue';
import ImportConfigPanel from '../components/business/auth/ImportConfigPanel.vue';
import BaseModal from '../components/base/BaseModal.vue';
import { useAuthStore } from '../stores/auth.js';
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
const toast = useToastStore();

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
    await auth.login(Object.assign({}, authTokenInfo.value));
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
  max-width: 560px;
  margin: 48px auto;
  padding: 24px;
}
.login-title {
  text-align: center;
  font-size: 20px;
  margin-bottom: 20px;
}
.login-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}
.login-tab {
  padding: 4px 14px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
}
.login-tab.active {
  border-color: #337ab7;
  color: #337ab7;
}
.login-actions {
  display: flex;
  justify-content: center;
  padding-left: 118px;
}
.login-submit {
  padding: 6px 24px;
  border: 1px solid #337ab7;
  background: #337ab7;
  color: #fff;
  border-radius: 3px;
  cursor: pointer;
}
.login-submit[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.login-btn {
  margin-left: 8px;
  padding: 6px 12px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
}
.login-btn-import {
  border-color: #5cb85c;
  color: #5cb85c;
}
.login-badge {
  display: inline-block;
  min-width: 16px;
  padding: 1px 5px;
  margin-left: 4px;
  border-radius: 8px;
  background: #777;
  color: #fff;
  font-size: 11px;
  text-align: center;
}
</style>