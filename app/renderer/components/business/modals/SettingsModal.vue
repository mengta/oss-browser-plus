<template>
  <BaseModal :visible="true" :title="t('settings')" :mask-closable="false" @close="onCancel">
    <div class="settings-body" data-testid="settings-modal">
      <fieldset>
        <legend><h5 class="st-legend">{{ t('settings.subtitle.updown') }}</h5></legend>

        <div class="st-row">
          <label class="st-label">{{ t('settings.maxUploadNum') }}:</label>
          <input
            v-model.number="form.maxUploadJobCount"
            type="number"
            class="st-input"
            min="1"
            max="10"
            :data-testid="'settings-maxUploadJobCount'"
            @change="setChange('maxUploadJobCount', $event)"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.maxDownloadNum') }}:</label>
          <input
            v-model.number="form.maxDownloadJobCount"
            type="number"
            class="st-input"
            min="1"
            max="10"
            data-testid="settings-maxDownloadJobCount"
            @change="setChange('maxDownloadJobCount', $event)"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.connectTimeout') }}:</label>
          <input
            v-model="form.connectTimeout"
            type="text"
            class="st-input"
            data-testid="settings-connectTimeout"
            @change="setChange('connectTimeout', $event)"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.uploadPartSize') }}:</label>
          <input
            v-model.number="form.uploadPartSize"
            type="number"
            class="st-input"
            min="5"
            max="100"
            data-testid="settings-uploadPartSize"
            @change="setChange('uploadPartSize', $event)"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.downloadConcurrecyPartSize') }}:</label>
          <input
            v-model.number="form.downloadConcurrecyPartSize"
            type="number"
            class="st-input"
            min="1"
            max="100"
            data-testid="settings-downloadConcurrecyPartSize"
            @change="setChange('downloadConcurrecyPartSize', $event)"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.uploadAndDownloadRetryTimes') }}:</label>
          <input
            v-model.number="form.uploadAndDownloadRetryTimes"
            type="number"
            class="st-input"
            min="3"
            max="20"
            data-testid="settings-uploadAndDownloadRetryTimes"
            @change="setChange('uploadAndDownloadRetryTimes', $event)"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend><h5 class="st-legend">{{ t('settings.subtitle.sys') }}</h5></legend>

        <div class="st-row">
          <label class="st-label">{{ t('settings.autoUpgrade') }}:</label>
          <label class="st-inline" data-testid="settings-autoUpgrade">
            <input v-model="form.autoUpgrade" type="checkbox" :true-value="1" :false-value="0" @change="setChange('autoUpgrade', $event)" />
            ({{ t('settings.autoUpgrade.msg') }})
          </label>
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.WhetherShowThumbnail') }}:</label>
          <label class="st-inline" data-testid="settings-showImageSnapshot">
            <input v-model="form.showImageSnapshot" type="checkbox" :true-value="1" :false-value="0" @change="setChange('showImageSnapshot', $event)" />
            ({{ t('settings.WhetherShowThumbnail.msg') }})
          </label>
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('language') }}:</label>
          <select v-model="locale" class="st-input st-select" data-testid="settings-language" @change="changeLanguage">
            <option v-for="item in langList" :key="item.lang" :value="item.lang">{{ item.label }}</option>
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <h5 class="st-legend">
            {{ t('settings.subtitle.email') }}
            <a class="st-help" :title="t('auth.authToken.tooltip')" @click.prevent="openExternal('https://github.com/aliyun/oss-browser/blob/master/docs/smtpSetting.md')">?</a>
          </h5>
        </legend>

        <div class="st-row">
          <label class="st-label">{{ t('settings.mailSmtp.addr') }}:</label>
          <input
            v-model="mailSmtp.host"
            type="text"
            class="st-input"
            placeholder="Host"
            data-testid="settings-smtp-host"
            @change="setMailChange"
          />
          <input
            v-model.number="mailSmtp.port"
            type="number"
            class="st-input st-port"
            placeholder="Port"
            data-testid="settings-smtp-port"
            @change="setMailChange"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.mailSmtp.ssl') }}:</label>
          <label class="st-inline">
            <input v-model="mailSmtp.secure" type="checkbox" data-testid="settings-smtp-ssl" @change="setMailChange" />
          </label>
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.mailSmtp.from') }}:</label>
          <input
            v-model="mailSmtp.from"
            type="text"
            class="st-input"
            placeholder="Email"
            data-testid="settings-smtp-from"
            @change="setMailChange"
          />
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('user') }}/{{ t('pass') }}:</label>
          <input
            v-model="mailSmtp.auth.user"
            type="text"
            class="st-input"
            placeholder="UserName"
            data-testid="settings-smtp-user"
            @change="setMailChange"
          />
          <input
            v-model="mailSmtp.auth.pass"
            type="password"
            class="st-input"
            placeholder="password"
            data-testid="settings-smtp-pass"
            @change="setMailChange"
          />
        </div>

        <div class="st-row">
          <label class="st-label"></label>
          <button
            type="button"
            class="st-btn"
            :disabled="!mailSmtp.from"
            data-testid="settings-smtp-test"
            @click="testMail"
          >
            {{ t('test') }}
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend><h5 class="st-legend">{{ t('settings.log') }}</h5></legend>

        <div class="st-row">
          <label class="st-label">{{ t('settings.console') }}:</label>
          <button type="button" class="st-btn" data-testid="settings-open-debug" @click="openDebug">
            {{ t('settings.console.msg') }}
          </button>
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.file') }}:</label>
          <label class="st-inline" data-testid="settings-logFile">
            <input v-model="form.logFile" type="checkbox" :true-value="1" :false-value="0" @change="setChange('logFile', $event)" />
            ({{ t('settings.file.msg') }})
          </label>
        </div>

        <div class="st-row">
          <label class="st-label">{{ t('settings.file.info') }}:</label>
          <label class="st-inline" data-testid="settings-logFileInfo">
            <input v-model="form.logFileInfo" type="checkbox" :true-value="1" :false-value="0" @change="setChange('logFileInfo', $event)" />
            ({{ t('settings.file.info.msg') }})
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend><h5 class="st-legend">{{ t('settings.other') }}</h5></legend>

        <div class="st-row">
          <label class="st-label">{{ t('settings.other.list.object.max.number') }}:</label>
          <input
            v-model.number="form.listObjectNum"
            type="number"
            class="st-input"
            min="30"
            max="1000"
            placeholder="30-1000"
            data-testid="settings-listObjectNum"
            @change="setChange('listObjectNum', $event)"
          />
        </div>
      </fieldset>
    </div>

    <template #footer>
      <button type="button" class="st-btn" data-testid="settings-close" @click="onCancel">
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { useSettingsStore } from '../../../stores/settings.js';
import { useUiStore } from '../../../stores/ui.js';
import { useToastStore } from '../../../stores/toast.js';
import { api } from '../../../services/api.js';
import { persistLocale, availableLocales } from '../../../i18n/index.js';
import { snapshot } from '../../../bootstrap.js';

// 等价 settingsCtrl + settings.html（B2-02 设置页主体 / B2-03 SMTP）
const emit = defineEmits(['close']);
const { t } = useI18n();
const settings = useSettingsStore();
const ui = useUiStore();
const toast = useToastStore();

const form = reactive({
  autoUpgrade: settings.autoUpgrade,
  maxUploadJobCount: settings.maxUploadJobCount,
  maxDownloadJobCount: settings.maxDownloadJobCount,
  showImageSnapshot: settings.showImageSnapshot,
  historiesLength: settings.historiesLength,
  logFile: settings.logFile,
  logFileInfo: settings.logFileInfo,
  connectTimeout: settings.connectTimeout,
  uploadPartSize: settings.uploadPartSize,
  downloadConcurrecyPartSize: settings.downloadConcurrecyPartSize,
  listObjectNum: settings.listObjectNum,
  uploadAndDownloadRetryTimes: settings.uploadAndDownloadRetryTimes,
});

const MAIL_DEFAULT = { port: 465 };
const mailSmtp = reactive(JSON.parse(JSON.stringify(settings.mailSmtp || MAIL_DEFAULT)));
if (!mailSmtp.auth) {
  mailSmtp.auth = { user: '', pass: '' };
}

// 语言列表：来自启动快照 locales（label + content），与原 Global.i18n 同源
const langList = availableLocales.map((lang) => ({
  lang,
  label: (snapshot && snapshot.locales && snapshot.locales[lang] && snapshot.locales[lang].label) || lang,
}));
const locale = ref((typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'zh-CN');

const REFRESH_KEYS = ['logFile', 'logFileInfo', 'uploadPartSize', 'uploadAndDownloadRetryTimes'];

function validate(key) {
  const value = form[key];
  const bounds = {
    maxUploadJobCount: [1, 10],
    maxDownloadJobCount: [1, 10],
    uploadPartSize: [5, 100],
    downloadConcurrecyPartSize: [1, 100],
    uploadAndDownloadRetryTimes: [3, 20],
    listObjectNum: [30, 1000],
  };
  if (key in bounds) {
    const [min, max] = bounds[key];
    const n = parseInt(value);
    if (isNaN(n) || n < min || n > max) {
      return false;
    }
  }
  if (key === 'connectTimeout' && String(value).trim() === '') {
    return false;
  }
  return true;
}

function setChange(key, event) {
  if (!validate(key)) {
    return;
  }
  settings.debouncedSet(key, form[key]);
  toast.push(t('settings.success'), 'success', 1000);
  if (REFRESH_KEYS.indexOf(key) !== -1) {
    applyRefresh(event);
  }
}

function setMailChange() {
  settings.debouncedSet('mailSmtp', JSON.parse(JSON.stringify(mailSmtp)));
}

function changeLanguage() {
  persistLocale(locale.value);
  toast.push(t('setup.success'), 'success', 1000);
}

function openExternal(url) {
  if (api && api.system && typeof api.system.openExternal === 'function') {
    api.system.openExternal(url);
  }
}

function applyRefresh() {
  if (api && api.system && typeof api.system.refreshPage === 'function') {
    api.system.refreshPage();
  }
}

function openDebug() {
  if (api && api.system && typeof api.system.openDevTools === 'function') {
    api.system.openDevTools();
  }
}

async function testMail() {
  const title = t('mail.test.title');
  const message = t('mail.test.message', { from: mailSmtp.from });
  const confirmed = await ui.confirm(title, message);
  if (!confirmed) {
    return;
  }
  toast.push(t('mail.send.on'), 'info', 1000);
  try {
    await api.mail.send(
      JSON.parse(JSON.stringify(mailSmtp)),
      { subject: 'OSS Browser Test', to: mailSmtp.from, html: 'test' }
    );
    toast.push(t('mail.test.success'), 'success', 1000);
  } catch (err) {
    const code = (err && err.code) || '';
    const message2 = (err && err.message) || String(err);
    toast.push(code ? code + ': ' + message2 : message2, 'danger', 3000);
  }
}

function onCancel() {
  emit('close');
}
</script>


<style scoped>
.settings-body {
  min-width: 520px;
  max-width: 640px;
}
fieldset {
  border: 1px solid #eee;
  margin: 0 0 10px;
  padding: 8px 10px;
}
.st-legend {
  margin: 0 0 6px;
  font-size: 13px;
  color: #337ab7;
  font-weight: bold;
}
.st-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.st-label {
  width: 170px;
  min-width: 170px;
  text-align: right;
  font-size: 12px;
  color: #555;
}
.st-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
  min-width: 0;
}
.st-select {
  max-width: 220px;
}
.st-port {
  flex: 0 0 90px;
}
.st-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #555;
}
.st-btn {
  padding: 4px 14px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.st-btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.st-help {
  cursor: pointer;
  color: #337ab7;
  text-decoration: none;
  font-weight: bold;
}
</style>