<template>
  <div class="restore-checker">
    <div v-if="loading" class="rc-loading" data-testid="restore-check-loading">{{ t('loading') }}</div>
    <template v-else>
      <div v-if="type === 1" class="rc-alert rc-danger" data-testid="restore-check-need">
        {{ t('restore.checker.message1') }}
        <button type="button" class="st-btn st-btn-primary" data-testid="restore-check-now" @click="showRestore">
          {{ t('restore.immediately') }}
        </button>
      </div>
      <div v-if="type === 2" class="rc-alert rc-warning" data-testid="restore-check-progress">
        <AppIcon name="hourglass" />
        {{ t('restore.onprogress') }}
      </div>
      <div v-if="type === 3" class="rc-alert rc-primary" data-testid="restore-check-ready">
        {{ t('restore.checker.message2') }}: {{ expiryText }}
      </div>
      <section v-if="showContent" class="rc-content" data-testid="restore-check-content">
        <slot />
      </section>
    </template>
  </div>
</template>

<script setup>
// 等价 restore-checker 指令（app/main/files/modals/preview/restore-checker.js）：
// type 1=归档需恢复（立即恢复入口）/ 2=恢复中 / 3=已恢复可读（显示截止时间）/ 0=普通对象。
// 可读时触发 ready（父组件加载预览内容）；恢复提交成功后重新 check 并通知父组件刷新存储状态。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import { ossClient } from '../../../services/oss-client.js';
import { restoreStateOf } from '../../../services/restore-info.js';
import { formatDateTime } from '../../../services/formatters.js';
import { useUiStore } from '../../../stores/ui.js';

const props = defineProps({
  bucketInfo: { type: Object, required: true },
  objectInfo: { type: Object, required: true },
  fileType: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['ready', 'restore-submit']);
const { t } = useI18n();
const ui = useUiStore();

const loading = ref(true);
const type = ref(0);
const expiry = ref('');
const showContent = ref(false);

const expiryText = computed(() => (expiry.value ? formatDateTime(expiry.value) : ''));

function check() {
  loading.value = true;
  showContent.value = false;
  const info = props.bucketInfo || {};
  const obj = props.objectInfo || {};
  ossClient
    .getFileInfo(info.region, info.bucket, obj.path)
    .then((data) => {
      if (data && data.Restore) {
        const state = restoreStateOf(data);
        if (state.type === 2) {
          type.value = 2;
        } else {
          type.value = 3;
          expiry.value = state.expiryDate;
          showContent.value = true;
          emit('ready');
        }
      } else if (obj.storageClass === 'Archive') {
        type.value = 1;
      } else {
        type.value = 0;
        showContent.value = true;
        emit('ready');
      }
    })
    .catch(() => {
      // 读取失败按普通对象处理（与原版一致：不阻断预览尝试）
      type.value = 0;
      showContent.value = true;
      emit('ready');
    })
    .finally(() => {
      loading.value = false;
    });
}

onMounted(check);

function showRestore() {
  ui.open('restore', { item: props.objectInfo, currentInfo: props.bucketInfo }).then((result) => {
    if (result) {
      emit('restore-submit');
      check();
    }
  });
}

defineExpose({ check });
</script>

<style scoped>
.restore-checker {
  min-height: 40px;
}
.rc-loading {
  padding: 20px;
  text-align: center;
  color: var(--vsc-fg-muted);
}
.rc-alert {
  padding: 12px;
  text-align: center;
  border-radius: 2px;
  margin: 8px 12px;
}
.rc-danger {
  background: var(--vsc-danger-bg);
  color: var(--vsc-danger);
}
.rc-warning {
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
}
.rc-primary {
  background: var(--vsc-info-bg);
  color: var(--vsc-link);
}
.st-btn {
  padding: 2px 10px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
}
.st-btn-primary {
  background: var(--vsc-accent);
  border-color: var(--vsc-accent-hover);
  color: var(--vsc-on-accent);
}
</style>