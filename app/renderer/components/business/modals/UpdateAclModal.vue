<template>
  <BaseModal :visible="true" :title="t('acl.update.title')" :mask-closable="false" @close="onCancel">
    <AclEditor v-model="info.acl" />
    <template #footer>
      <button type="button" class="st-btn st-btn-success" data-testid="acl-submit" @click="onSubmit">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="acl-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import AclEditor from '../editors/AclEditor.vue';
import ossClient from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';

// 等价 updateACLModalCtrl：getACL 回显 → updateACL 提交 → success Toast → 关闭
const props = defineProps({
  item: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();

const info = ref({ acl: 'default' });

onMounted(() => {
  ossClient
    .getACL(props.currentInfo.region, props.currentInfo.bucket, props.item.path)
    .then((res) => {
      const acl = res && res.acl ? res.acl : 'default';
      info.value.acl = acl || 'default';
    })
    .catch(() => {});
});

function onCancel() {
  emit('close');
}

function onSubmit() {
  ossClient
    .updateACL(props.currentInfo.region, props.currentInfo.bucket, props.item.path, info.value.acl)
    .then(() => {
      toast.push(t('acl.update.success'), 'success', 1000);
      emit('close');
    })
    .catch(() => {});
}
</script>

<style scoped>
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-success {
  background: var(#2ea043);
  border-color: #2ea043;
  color: var(--vsc-on-accent);
}
</style>