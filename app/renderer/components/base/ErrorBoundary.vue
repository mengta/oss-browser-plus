<template>
  <div class="error-boundary">
    <div v-if="error" class="eb-box" data-testid="error-boundary">
      <div class="eb-title" data-testid="error-boundary-message">{{ t('error.render') }}</div>
      <div class="eb-detail">{{ error.message }}</div>
      <div class="eb-actions">
        <button type="button" class="st-btn st-btn-primary" data-testid="error-boundary-retry" @click="retry">
          {{ t('refresh') }}
        </button>
        <button type="button" class="st-btn" data-testid="error-boundary-close" @click="dismiss">
          {{ t('close') }}
        </button>
      </div>
    </div>
    <slot v-else />
  </div>
</template>

<script setup>
// B4-06：组件级错误边界（onErrorCaptured）：捕获子树渲染异常 → 可关闭提示 + 重试；
// 日志仅含组件名/路由/操作名，不含 AK/SK/token/密码。
import { onErrorCaptured, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const emit = defineEmits(['retry']);
const { t } = useI18n();
const route = useRoute();
const error = ref(null);

onErrorCaptured((err, instance, info) => {
  const name =
    (instance && instance.$options && (instance.$options.name || instance.$options.__name)) || 'anonymous';
  console.error('[error-boundary] component=' + name + ' route=' + route.path + ' info=' + info + ' message=' + ((err && err.message) || String(err)));
  error.value = { message: (err && err.message) || String(err) };
  return false;
});

function retry() {
  error.value = null;
  emit('retry');
}

function dismiss() {
  error.value = null;
}
</script>

<style scoped>
.eb-box {
  margin: 20px auto;
  max-width: 560px;
  padding: 16px;
  border: 1px solid var(--vsc-warning-solid);
  border-radius: 2px;
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
}
.eb-title {
  font-weight: bold;
  margin-bottom: 6px;
}
.eb-detail {
  font-size: 12px;
  word-break: break-all;
  margin-bottom: 10px;
}
.eb-actions {
  display: flex;
  gap: 8px;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-primary {
  background: var(--vsc-accent);
  border-color: var(--vsc-accent-hover);
  color: var(--vsc-on-accent);
}
</style>