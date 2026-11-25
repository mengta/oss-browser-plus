<template>
  <div class="auth-token-form" data-testid="auth-token-form">
    <textarea
      class="atf-input"
      :value="modelValue"
      rows="8"
      :placeholder="t('auth.authToken.placeholder')"
      data-testid="auth-token-input"
      @input="onInput"
    ></textarea>

    <small v-if="token && !info" class="atf-error" data-testid="auth-token-invalid">
      {{ t('auth.authToken.error.invalid') }}
    </small>
    <small v-else-if="info && info.isExpired" class="atf-error" data-testid="auth-token-expired">
      {{ t('auth.authToken.error.expired') }}
    </small>
    <small v-else-if="info && info.expiration" class="atf-ok" data-testid="auth-token-valid">
      ({{ t('auth.authToken.info.validUntil', { expiration: info.expirationStr || '' }) }})
    </small>

    <div class="atf-actions">
      <button
        type="button"
        class="atf-submit"
        :disabled="!info || info.isExpired"
        data-testid="auth-token-submit"
        @click="$emit('submit')"
      >
        {{ t('auth.login') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  modelValue: { type: String, default: '' },
  info: { type: Object, default: null },
});

const emit = defineEmits(['update:modelValue', 'submit']);
const { t } = useI18n();

const token = computed(() => String(props.modelValue || ''));

function onInput(event) {
  emit('update:modelValue', event.target.value);
}
</script>

<style scoped>
.auth-token-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.atf-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
}
.atf-error {
  color: #d9534f;
}
.atf-ok {
  color: #5cb85c;
}
.atf-actions {
  display: flex;
  justify-content: center;
  padding-left: 118px;
}
.atf-submit {
  padding: 6px 24px;
  border: 1px solid #337ab7;
  background: #337ab7;
  color: #fff;
  border-radius: 3px;
  cursor: pointer;
}
.atf-submit[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>