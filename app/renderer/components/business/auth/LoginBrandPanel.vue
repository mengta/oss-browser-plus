<template>
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
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import { useBootstrapStore } from '../../../stores/bootstrap.js';

const { t } = useI18n();
const bootstrapStore = useBootstrapStore();

const logo = computed(() => {
  const snapshot = bootstrapStore.snapshot || {};
  return snapshot.logo || '';
});
</script>

<style scoped>
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

@media (max-width: 900px) {
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
}
</style>