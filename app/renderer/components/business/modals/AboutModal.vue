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
          <a href="javascript:;" data-testid="about-opensource-link" @click.prevent="openURL('https://github.com/mengta/oss-browser-plus')">https://github.com/mengta/oss-browser-plus</a>
        </small>
      </div>

    </div>

    <template #footer>
      <button type="button" class="about-btn" data-testid="about-close" @click="onCancel">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { api } from '../../../services/api.js';
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

function openURL(url) {
  if (api && api.system && typeof api.system.openExternal === 'function') {
    api.system.openExternal(url);
  }
}

function onCancel() {
  emit('close');
}

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
  color: #8a6d00;
}
.about-custom,
.about-opensource {
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
}
.about-opensource .text-muted {
  color: var(--vsc-fg-muted);
}
.about-note {
  font-size: 12px;
}
.about-btn {
  padding: 4px 14px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.about-btn-success {
  border-color: #2ea043;
  background: var(#2ea043);
  color: var(--vsc-on-accent);
}
.about-progress {
  margin: 8px 0;
}
.progress-track {
  height: 10px;
  background: var(--vsc-border-weak);
  border-radius: 2px;
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
  color: #a1260d;
  margin: 6px 0;
}
.about-release-note {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--vsc-border-weak);
  font-size: 12px;
  max-height: 220px;
  overflow: auto;
}
</style>