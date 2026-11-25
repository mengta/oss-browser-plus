<template>
  <BaseModal :visible="true" :title="t('about')" :mask-closable="false" @close="onCancel">
    <div class="about-body" data-testid="about-modal">
      <h4 class="about-head">
        <img :src="logo" style="display: inline-block" width="40" alt="logo" data-testid="about-logo" />
        &nbsp;&nbsp;{{ t('app.name') }}
        <small class="about-version" data-testid="about-version">v {{ appVersion }}</small>
      </h4>

      <div v-if="customAboutHtml" class="about-custom" data-testid="about-custom" v-html="customAboutHtml"></div>

      <div v-else class="about-opensource">
        <small class="text-muted">
          {{ t('opensource.address') }}:
          <a href="javascript:;" data-testid="about-opensource-link" @click.prevent="openURL('https://github.com/aliyun/oss-browser')">https://github.com/aliyun/oss-browser</a>
        </small>
      </div>

      <hr />

      <div v-if="checking" class="about-note" data-testid="about-checking">{{ t('loading') }}</div>
      <div v-else class="about-note">
        <div v-if="!isLastVersion" class="about-new" data-testid="about-new-version">
          <span class="text-info">
            {{ t('foundNewVersion') }} v {{ lastVersion }} &nbsp;&nbsp;&nbsp;&nbsp;
            <a href="javascript:;" class="about-btn about-btn-success" data-testid="about-download" @click.prevent="download">{{ t('clickToDownload') }}</a>
          </span>

          <div v-if="upgradeJob.status === 'running'" class="about-progress">
            {{ t('upgrade.downloading') }}
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: upgradeJob.progress + '%' }"></div>
            </div>
          </div>

          <div v-if="upgradeJob.status === 'finished'" class="about-actions">
            <button type="button" class="about-btn about-btn-success" data-testid="about-install" @click="installAndRestart">
              {{ t('upgrade.installNow') }}
            </button>
          </div>

          <div v-if="upgradeJob.status === 'error'" class="about-error">{{ upgradeJob.message }}</div>

          <div v-if="lastReleaseNoteHtml" class="about-release-note" data-testid="about-release-note" v-html="lastReleaseNoteHtml"></div>
        </div>
        <div v-else data-testid="about-no-new">{{ t('uptodate') }}</div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="about-btn" data-testid="about-close" @click="onCancel">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { api } from '../../../services/api.js';
import { compareVersion } from '../../../services/compare-version.js';
import { renderMarkdown } from '../../../services/markdown.js';
import { readSnapshot } from '../../../bootstrap.js';

// 等价 aboutCtrl + about.html：
// 展示 logo/应用名/版本（含定制）/定制 about_html（未定制回退开源地址）；
// 版本检测经 upgrade:check（等价 autoUpgradeSvs.load 检测部分）；
// 新版本展示下载链接 / 下载进度 / 安装重启；release notes 经 showdown 渲染（B2-14 评估结论保留）。
const emit = defineEmits(['close']);
const { t } = useI18n();

const snap = readSnapshot() || {};
const appVersion = snap.appVersion || '0.0.0';
const logo = snap.logo || 'icons/icon.png';
const customAboutHtml = snap.aboutHtml || '';

const checking = ref(false);
const isLastVersion = ref(true);
const lastVersion = ref('');
const downloadLink = ref('');
const lastReleaseNoteHtml = ref('');
const upgradeJob = ref({ status: 'waiting', progress: 0, message: '' });

function openURL(url) {
  if (api && api.system && typeof api.system.openExternal === 'function') {
    api.system.openExternal(url);
  }
}

// upgrade 桥直调（等价 mailer.js 的 bridge 模式，避免 api 门面构建时机差异）
function upgradeBridge() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.upgrade || null;
}

function fetchReleaseNote(version) {
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'zh-CN';
  const base = (snap && snap.releaseNotesUrl) || '';
  if (!base || typeof window.fetch !== 'function') {
    return;
  }
  const url = compareVersion(version, '1.5.1') <= 0 ? base + version + '.md' : base + version + '.' + lang + '.md';
  window
    .fetch(url)
    .then((res) => res.text())
    .then((text) => {
      lastReleaseNoteHtml.value = renderMarkdown(String(text || ''));
    })
    .catch(() => {});
}


function download() {
  if (downloadLink.value) {
    openURL(downloadLink.value);
    return;
  }
  const bridgeApi = upgradeBridge();
  if (bridgeApi && typeof bridgeApi.download === 'function') {
    bridgeApi.download(lastVersion.value);
  }
}

function installAndRestart() {
  const bridgeApi = upgradeBridge();
  if (bridgeApi && typeof bridgeApi.install === 'function') {
    bridgeApi.install(lastVersion.value);
  }
}

function checkUpgrade() {
  const bridgeApi = upgradeBridge();
  if (!bridgeApi || typeof bridgeApi.check !== 'function') {
    return;
  }
  checking.value = true;
  Promise.resolve()
    .then(() => bridgeApi.check())
    .then((res) => {
      checking.value = false;
      const data = res && res.ok ? res.data : null;
      if (!data || !data.version) {
        isLastVersion.value = true;
        return;
      }
      lastVersion.value = data.version;
      isLastVersion.value = compareVersion(appVersion, data.version) >= 0;
      if (!isLastVersion.value) {
        fetchReleaseNote(data.version);
        if (data.package_url) {
          const fileName = 'oss-browser-' + appVersion + '-' + (snap.platform || 'win32') + '-' + (snap.arch || 'x64') + '.zip';
          downloadLink.value = String(data.package_url).replace(/\/*$/g, '') + '/' + data.version + '/' + fileName;
        }
        if (typeof bridgeApi.subscribe === 'function') {
          bridgeApi.subscribe((payload) => {
            if (payload && payload.upgradeJob) {
              upgradeJob.value = payload.upgradeJob;
            }
          });
        }
      }
    })
    .catch(() => {
      checking.value = false;
    });
}

function onCancel() {
  emit('close');
}

onMounted(() => {
  checkUpgrade();
});
</script>

<style scoped>
.about-body {
  min-width: 420px;
}
.about-head {
  text-align: center;
  margin: 4px 0 8px;
}
.about-version {
  color: #f0ad4e;
}
.about-custom,
.about-opensource {
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
}
.about-opensource .text-muted {
  color: #999;
}
.about-note {
  font-size: 12px;
}
.about-btn {
  padding: 4px 14px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.about-btn-success {
  border-color: #5cb85c;
  background: #5cb85c;
  color: #fff;
}
.about-progress {
  margin: 8px 0;
}
.progress-track {
  height: 10px;
  background: #eee;
  border-radius: 5px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #5bc0de;
  transition: width 0.3s;
}
.about-actions {
  margin: 8px 0;
}
.about-error {
  color: #d9534f;
  margin: 6px 0;
}
.about-release-note {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #ddd;
  font-size: 12px;
  max-height: 220px;
  overflow: auto;
}
</style>