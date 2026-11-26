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

      <div v-if="releaseNotesVisible || releaseError" class="about-release-note" data-testid="about-release-notes">
        <div class="about-release-title">{{ t('about.releaseNotes') }}</div>
        <div v-if="releaseError && !releaseErrorDismissed" class="about-release-error" data-testid="about-release-error">
          <span>{{ t('about.releaseNotesFailed') }}</span>
          <button type="button" class="about-error-dismiss" :aria-label="t('close')" data-testid="about-release-error-dismiss" @click="releaseErrorDismissed = true"><span class="about-error-dismiss-icon" aria-hidden="true"></span></button>
        </div>
        <div v-if="releaseNotesVisible" class="about-release-body" data-testid="about-release-body" v-html="releaseNotesHtml"></div>
      </div>

    </div>

    <template #footer>
      <button type="button" class="about-btn" data-testid="about-close" @click="onCancel">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { api } from '../../../services/api.js';
import { readSnapshot } from '../../../bootstrap.js';
import { renderMarkdown, sanitizeHtml, setRenderErrorHandler } from '../../../services/markdown.js';

// 等价 aboutCtrl + about.html：
// 展示 logo/应用名/版本（含定制）/定制 about_html（未定制回退开源地址）/发行说明；
// 定制 about_html 与发行说明均为外部内容，v-html 前统一 sanitize，渲染失败给出可关闭提示（不静默降级）。
const emit = defineEmits(['close']);
const { t, locale } = useI18n();

const snap = readSnapshot() || {};
const appVersion = snap.appVersion || '0.0.0';
const logo = snap.logo || 'icons/icon.png';
const customAboutHtml = sanitizeHtml(snap.aboutHtml || '');

const releaseNotesHtml = ref('');
const releaseNotesVisible = ref(false);
const releaseError = ref('');
const releaseErrorDismissed = ref(false);

setRenderErrorHandler((info) => {
  releaseError.value = (info && info.code) || 'MARKDOWN_RENDER_FAILED';
});

async function loadReleaseNotes() {
  const system = api && api.system;
  if (!system || typeof system.readReleaseNotes !== 'function') {
    return;
  }
  try {
    const res = await system.readReleaseNotes(appVersion, locale.value);
    if (!res) {
      releaseError.value = 'IO';
      return;
    }
    if (res.ok !== true) {
      releaseError.value = res.code || 'IO';
      return;
    }
    if (!res.data || res.data.found !== true) {
      return;
    }
    const html = renderMarkdown(res.data.markdown || '');
    if (html) {
      releaseNotesHtml.value = html;
      releaseNotesVisible.value = true;
    }
  } catch (err) {
    releaseError.value = (err && err.code) || 'MARKDOWN_RENDER_FAILED';
  }
}

onMounted(loadReleaseNotes);

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
  color: var(--vsc-warning);
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
  border-color: var(--vsc-success);
  background: var(--vsc-success-solid);
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
  background: var(--vsc-accent);
  transition: width 0.3s;
}
.about-actions {
  margin: 8px 0;
}
.about-error {
  color: var(--vsc-danger);
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
.about-release-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.about-release-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--vsc-danger);
  margin: 6px 0;
}
.about-error-dismiss {
  border: none;
  background: transparent;
  color: var(--vsc-danger);
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px;
}
.about-error-dismiss-icon::before {
  content: '×';
}
.about-release-body {
  text-align: left;
  line-height: 1.5;
}
</style>