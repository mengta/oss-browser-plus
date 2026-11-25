<template>
  <div class="acl-editor" data-testid="acl-editor">
    <div class="form-group">
      <label class="control-label" data-testid="acl-label">{{ t('privilege') }}:</label>
      <select v-model="acl" class="form-control" data-testid="acl-select">
        <option value="default">{{ t('aclType.default') }}</option>
        <option value="private">{{ t('aclType.private') }}</option>
        <option value="public-read">{{ t('aclType.public-read') }}</option>
        <option value="public-read-write">{{ t('aclType.public-read-write') }}</option>
      </select>
    </div>

    <div class="f9 text-muted">
      <li>{{ t('aclType.private.message') }}</li>
      <li>{{ t('aclType.public-read.message') }}</li>
      <li>{{ t('aclType.public-read-write.message') }}</li>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// 等价 update-acl-modal 的 ACL 表单主体（select + 三行说明）；
// 回显与提交由弹窗承接（ossClient.getACL/updateACL）。
const props = defineProps({
  modelValue: { type: String, default: 'default' },
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const acl = ref(props.modelValue || 'default');

watch(
  () => props.modelValue,
  (next) => {
    acl.value = next || 'default';
  }
);

watch(acl, (next) => {
  emit('update:modelValue', next);
});
</script>

<style scoped>
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.control-label {
  white-space: nowrap;
}
.form-control {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
}
.f9 li {
  color: #999;
  font-size: 12px;
}
</style>