<template>
  <BaseModal :visible="true" :title="t('bucketACL.update')" :mask-closable="false" @close="onCancel">
    <div class="update-bucket-form">
      <div class="form-group">
        <label>{{ t('bucket.name') }}</label>
        <input :value="bucketInfo.name" type="text" class="form-control" readonly data-testid="update-bucket-name" />
      </div>
      <div class="form-group">
        <label>{{ t('region') }}</label>
        <input :value="bucketInfo.region" type="text" class="form-control" readonly data-testid="update-bucket-region" />
      </div>
      <div class="form-group">
        <label>{{ t('acl') }}</label>
        <select v-model="acl" class="form-control" data-testid="update-bucket-acl">
          <option v-for="a in bucketAcl" :key="a.acl" :value="a.acl">{{ a.label }}</option>
        </select>
      </div>
    </div>
    <template #footer>
      <button type="button" class="st-btn st-btn-success" data-testid="update-bucket-submit" @click="onSubmit">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="update-bucket-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 update-bucket-modal（app/main/files/modals/update-bucket-modal.js）：
// name/region 只读，getBucketACL 回显 → 仅可改 ACL → updateBucketACL → Toast → close(true)。
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';
import { BUCKET_ACL } from '../../../services/const-data.js';

const props = defineProps({
  bucketInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();
const bucketAcl = BUCKET_ACL;
const acl = ref('private');

onMounted(() => {
  ossClient
    .getBucketACL(props.bucketInfo.region, props.bucketInfo.name)
    .then((res) => {
      // 原版隐患保持：'default' 无对应选项时不回显（bucketACL 无 default 项）
      if (res && res.acl && bucketAcl.some((a) => a.acl === res.acl)) {
        acl.value = res.acl;
      }
    })
    .catch(() => {});
});

function onCancel() {
  emit('close');
}

function onSubmit() {
  ossClient
    .updateBucketACL(props.bucketInfo.region, props.bucketInfo.name, acl.value)
    .then(() => {
      toast.push(t('bucketACL.update.success'), 'success', 2000);
      emit('close', true);
    })
    .catch(() => {});
}
</script>

<style scoped>
.update-bucket-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 360px;
}
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-group label {
  width: 110px;
  text-align: right;
  color: var(--vsc-fg-muted);
}
.form-group .form-control {
  flex: 1;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-success {
  background: var(--vsc-success-solid);
  border-color: var(--vsc-success);
  color: var(--vsc-on-accent);
}
</style>