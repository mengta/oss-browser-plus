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
.transfer-dock {
  border-top: 1px solid #e5e5e5;
}
.trans-dock-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 10px;
  font-size: 12px;
}
.trans-dock-btn a {
  color: #1890ff;
  text-decoration: none;
}
.trans-frame {
  display: flex;
  flex-direction: column;
}
.trans-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 4px 8px 0;
  border-bottom: 1px solid #e5e5e5;
}
.trans-nav li {
  padding: 4px 12px;
  cursor: pointer;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 3px 3px 0 0;
  font-size: 13px;
  color: #666;
}
.trans-nav li.active {
  border-color: #e5e5e5;
  background: #fff;
  color: #1890ff;
  margin-bottom: -1px;
}
.trans-nav li a {
  color: inherit;
  text-decoration: none;
}
.badge {
  background: #f0f0f0;
  border-radius: 8px;
  padding: 0 6px;
  margin-left: 4px;
  font-size: 11px;
  color: #666;
}
.spacer {
  flex: 1;
}
.dock-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  color: #999;
  padding: 2px 8px;
}
</style>