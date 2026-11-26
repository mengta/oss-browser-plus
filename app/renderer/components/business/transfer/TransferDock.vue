<template>
  <div class="transfer-dock" data-testid="transfer-dock">
    <!-- 折叠态（等价 frame.html:2-12）：upDone/总数 计数入口，点击展开对应 tab -->
    <div v-if="!transferStore.visible" class="trans-dock-btn">
      <a href="javascript:void(0)" data-testid="dock-upload" @click="openTab('upload')">
        {{ t('upload') }} {{ transferStore.uploadDone }}/{{ transferStore.uploads.length }}
      </a>
      <a href="javascript:void(0)" data-testid="dock-download" @click="openTab('download')">
        {{ t('download') }} {{ transferStore.downloadDone }}/{{ transferStore.downloads.length }}
      </a>
    </div>

    <!-- 展开态（等价 frame.html:14-55）：tab 头（计数徽标）+ 关闭 + 面板 -->
    <div v-else class="trans-frame">
      <ul class="trans-nav" data-testid="transfer-tabs">
        <li
          role="presentation"
          data-testid="tab-upload"
          :class="{ active: transferStore.activeTab !== 'download' }"
        >
          <a href="javascript:void(0)" @click="transferStore.setVisible(true, 'upload')">
            {{ t('upload') }}
            <label class="badge" data-testid="tab-upload-count">
              {{ transferStore.uploadDone }}/{{ transferStore.uploads.length }}
            </label>
          </a>
        </li>
        <li
          role="presentation"
          data-testid="tab-download"
          :class="{ active: transferStore.activeTab === 'download' }"
        >
          <a href="javascript:void(0)" @click="transferStore.setVisible(true, 'download')">
            {{ t('download') }}
            <label class="badge" data-testid="tab-download-count">
              {{ transferStore.downloadDone }}/{{ transferStore.downloads.length }}
            </label>
          </a>
        </li>
        <span class="spacer" />
        <button type="button" class="dock-close" data-testid="dock-close" @click="transferStore.setVisible(false)">
          ×
        </button>
      </ul>
      <UploadsPanel v-if="transferStore.activeTab !== 'download'" />
      <DownloadsPanel v-else />
    </div>
  </div>
</template>

<script setup>
// B3-08：传输中心（等价 app/main/files/transfer/frame.html + frame.js）：
// 折叠态双计数（upDone/总数、downDone/总数，口径见 frame.js calcTotalProg）；
// 展开态双 tab（活跃高亮 + 计数徽标）+ 关闭；无总进度条/总速度（原版亦无）。
import { useI18n } from 'vue-i18n';
import UploadsPanel from './UploadsPanel.vue';
import DownloadsPanel from './DownloadsPanel.vue';
import { useTransferStore } from '../../../stores/transfer.js';

const { t } = useI18n();
const transferStore = useTransferStore();

function openTab(tab) {
  transferStore.setVisible(true, tab);
}
</script>

<style scoped>
/* 右下角悬浮：折叠为小胶囊，展开为浮窗（不再占据列表页底部版面） */
.transfer-dock {
  position: fixed;
  right: 14px;
  bottom: 32px;
  z-index: 1045;
}
.trans-dock-btn {
  display: flex;
  align-items: center;
  background: var(--vsc-bg-elevated);
  border: 1px solid var(--vsc-border);
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.trans-dock-btn a {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--vsc-fg);
  text-decoration: none;
  white-space: nowrap;
}
.trans-dock-btn a + a {
  border-left: 1px solid var(--vsc-border-weak);
}
.trans-dock-btn a:hover {
  background: var(--vsc-bg-hover);
  color: var(--vsc-link);
}
.trans-frame {
  width: 520px;
  max-width: calc(100vw - 28px);
  max-height: 62vh;
  display: flex;
  flex-direction: column;
  background: var(--vsc-bg-elevated);
  border: 1px solid var(--vsc-border);
  border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.trans-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 4px 8px 0;
  border-bottom: 1px solid var(--vsc-border-weak);
  flex: 0 0 auto;
}
.trans-nav li {
  padding: 4px 12px;
  cursor: pointer;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 2px 3px 0 0;
  font-size: 13px;
  color: var(--vsc-fg-muted);
}
.trans-nav li.active {
  border-color: var(--vsc-border-weak);
  background: var(--vsc-bg-elevated);
  color: var(--vsc-link);
  margin-bottom: -1px;
}
.trans-nav li a {
  color: inherit;
  text-decoration: none;
}
.badge {
  background: var(--vsc-border-weak);
  border-radius: 2px;
  padding: 0 6px;
  margin-left: 4px;
  font-size: 11px;
  color: var(--vsc-fg-muted);
}
.spacer {
  flex: 1;
}
.dock-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--vsc-fg-muted);
  padding: 2px 8px;
}
.dock-close:hover {
  color: var(--vsc-fg);
  background: var(--vsc-bg-hover);
}
.trans-frame :deep(.uploads-panel),
.trans-frame :deep(.downloads-panel) {
  flex: 1;
  min-height: 0;
  max-height: none;
  border-top: none;
}
.trans-frame :deep(.panel-toolbar) {
  flex-wrap: wrap;
}
.trans-frame :deep(.long-scroll-list) {
  flex: 1;
  min-height: 0;
  height: auto;
}
</style>