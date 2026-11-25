<template>
  <BaseModal :visible="true" :title="t('bucket.add')" :mask-closable="false" @close="onCancel">
    <form class="add-bucket-form" @submit.prevent="onSubmit">
      <div class="form-group">
        <label>{{ t('bucket.name') }}</label>
        <input
          v-model="item.name"
          type="text"
          class="form-control"
          data-testid="add-bucket-name"
          :placeholder="t('bucket.name')"
          spellcheck="false"
        />
      </div>
      <div v-if="showRegion" class="form-group">
        <label>{{ t('region') }}</label>
        <select v-model="item.region" class="form-control" data-testid="add-bucket-region" @change="onRegionChange">
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ regionLabel(r) }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>{{ t('acl') }}</label>
        <select v-model="item.acl" class="form-control" data-testid="add-bucket-acl" @change="onAclChange">
          <option v-for="a in bucketAcl" :key="a.acl" :value="a.acl">{{ a.label }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>{{ t('storageClass') }}</label>
        <select v-model="item.storageClass" class="form-control" data-testid="add-bucket-sc">
          <option v-for="s in storageClasses" :key="s.value" :value="s.value">{{ s.name }}</option>
        </select>
      </div>
    </form>
    <template #footer>
      <button type="button" class="st-btn st-btn-success" data-testid="add-bucket-submit" @click="onSubmit">
        {{ t('ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="add-bucket-cancel" @click="onCancel">
        {{ t('cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 add-bucket-modal（app/main/files/modals/add-bucket-modal.js）：
// name 正则 /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/、region 切换重置 storageClass=Standard、
// ACL 非 private 风险警示、createBucket(region,name,acl,storageClass) → close(true)（父级 Toast+1s 刷新）。
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import { ossClient } from '../../../services/oss-client.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';
import { BUCKET_ACL, REGIONS, getStorageClasses } from '../../../services/const-data.js';

const NAME_REG = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();
const ui = useUiStore();

const regions = REGIONS;
const bucketAcl = BUCKET_ACL;
// 等价 showRegion：customize/privateLink 场景隐藏区域选择（默认显示）
const showRegion = ref(true);

const item = ref({
  name: '',
  region: regions[0].id,
  acl: bucketAcl[0].acl,
  storageClass: 'Standard',
});

const storageClasses = computed(() => {
  const r = regions.find((x) => x.id === item.value.region);
  return (r && r.storageClasses) || getStorageClasses(1);
});

function regionLabel(r) {
  return t('region.' + r.id) || r.label;
}

function onRegionChange() {
  item.value.storageClass = 'Standard';
}

function onAclChange() {
  const acl = item.value.acl;
  if (acl && acl !== 'private') {
    ui.alert(t('warn'), t('acl.warn-not-private.' + acl));
  }
}

function onCancel() {
  emit('close');
}

function onSubmit() {
  if (!NAME_REG.test(item.value.name || '')) {
    toast.push(t('bucket.add.name.invalid'), 'danger', 3000);
    return;
  }
  ossClient
    .createBucket(item.value.region, item.value.name, item.value.acl, item.value.storageClass)
    .then(() => {
      emit('close', true);
    })
    .catch(() => {});
}
</script>

<style scoped>
.add-bucket-form {
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
  color: #555;
}
.form-group .form-control {
  flex: 1;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.st-btn-success {
  background: #5cb85c;
  border-color: #4cae4c;
  color: #fff;
}
</style>