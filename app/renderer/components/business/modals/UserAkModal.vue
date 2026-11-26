<template>
  <BaseModal :visible="true" :title="t('aks') + ' (' + (user.UserName || '') + ')'" :mask-closable="false" @close="onCancel">
    <div class="ak-body" data-testid="user-ak-modal">
      <div class="st-row">
        <input
          v-model="sch"
          type="text"
          class="st-input"
          placeholder="search"
          data-testid="user-ak-search"
        />
        <button type="button" class="st-btn st-btn-add" data-testid="user-ak-add" @click="showAdd">
          {{ t('add') }}
        </button>
        <button type="button" class="st-btn" data-testid="user-ak-refresh" @click="refresh">
          {{ t('refresh') }}
        </button>
      </div>

      <div v-if="isLoading" class="st-loading" data-testid="user-ak-loading">{{ t('loading') }}</div>
      <div v-else-if="filtered.length === 0" class="st-empty" data-testid="user-ak-empty">{{ t('no.data') }}</div>

      <table v-else class="ak-table" data-testid="user-ak-table">
        <tr>
          <th>{{ t('accessKeyId') }}</th>
          <th>{{ t('accessKeySecret') }}</th>
          <th>{{ t('status') }}</th>
          <th>{{ t('lastModifyTime') }}</th>
          <th>{{ t('actions') }}</th>
        </tr>
        <tr v-for="item in filtered" :key="item.AccessKeyId" data-testid="user-ak-row">
          <td class="break">{{ item.AccessKeyId }}</td>
          <td class="break">{{ item.AccessKeySecret || '-' }}</td>
          <td :class="item.Status === 'Active' ? 'text-primary' : 'text-danger'">{{ item.Status }}</td>
          <td>{{ formatDateTime(item.UpdateDate) }}</td>
          <td>
            <a href="javascript:;" class="text-primary" data-testid="user-ak-status" @click="updateStatus(item)">{{ t('update') }}</a>
            |
            <a href="javascript:;" class="text-danger" data-testid="user-ak-remove" @click="showRemove(item)">{{ t('delete') }}</a>
          </td>
        </tr>
      </table>
    </div>

    <template #footer>
      <button type="button" class="st-btn" data-testid="user-ak-close" @click="onCancel">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import ramClient from '../../../services/ram-client.js';
import { userAkStore } from '../../../services/user-ak-store.js';
import { formatDateTime } from '../../../services/formatters.js';
import { useUiStore } from '../../../stores/ui.js';
import { useToastStore } from '../../../stores/toast.js';

// 等价 userAKCtrl：
// 刷新 = 本地 AK secret 表（indexDB）合并 RAM AccessKeys，按 UpdateDate 降序；
// showAdd 创建后本地保存；updateStatus 启停切换；showRemove 删除（重复定义的后者优先，danger 确认）。
const props = defineProps({
  user: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const ui = useUiStore();
const toast = useToastStore();

const items = ref([]);
const isLoading = ref(false);
const sch = ref('');

const filtered = computed(() => {
  const key = String(sch.value || '').trim();
  if (!key) {
    return items.value;
  }
  return items.value.filter((item) => {
    for (const field of ['AccessKeyId', 'AccessKeySecret', 'Status']) {
      if (item[field] && String(item[field]).indexOf(key) !== -1) {
        return true;
      }
    }
    return false;
  });
});

function refresh() {
  isLoading.value = true;
  userAkStore
    .list()
    .then((arr) => {
      const akMap = {};
      for (const n of arr) {
        akMap[n.AccessKeyId] = n.AccessKeySecret;
      }
      return ramClient.listAccessKeys(props.user.UserName).then((result) => {
        isLoading.value = false;
        const list = result.AccessKeys.AccessKey;
        for (const n of list) {
          n.AccessKeySecret = akMap[n.AccessKeyId] || '';
        }
        list.sort((a, b) => (a.UpdateDate < b.UpdateDate ? 1 : -1));
        items.value = list;
      });
    })
    .catch(() => {
      isLoading.value = false;
    });
}

function showAdd() {
  ramClient
    .createAccessKey(props.user.UserName)
    .then((result) =>
      userAkStore.save({
        AccessKeyId: result.AccessKey.AccessKeyId,
        AccessKeySecret: result.AccessKey.AccessKeySecret,
        UserName: props.user.UserName,
      })
    )
    .then(() => refresh())
    .catch(() => {});
}

function updateStatus(item) {
  const title = t('ak.status.update.title.' + item.Status);
  const message = t('ak.status.update.message.' + item.Status);
  const status = item.Status === 'Active' ? 'Inactive' : 'Active';

  uiConfirm(title, message, item.Status === 'Active' ? 'danger' : 'primary').then((b) => {
    if (!b) {
      return;
    }
    ramClient.updateAccessKey(props.user.UserName, item.AccessKeyId, status).then(() => refresh()).catch(() => {});
  });
}

function showRemove(item) {
  // 原版 showRemove 存在两次定义，后者生效：ak.delete.title / ak.delete.message / danger
  const title = t('ak.delete.title');
  const message = t('ak.delete.message');

  uiConfirm(title, message, 'danger').then((b) => {
    if (!b) {
      return;
    }
    ramClient.deleteAccessKey(props.user.UserName, item.AccessKeyId).then(() => refresh()).catch(() => {});
  });
}

function uiConfirm(title, message, cls) {
  return ui.confirm(title, message, { cls });
}

function onCancel() {
  emit('close');
}

refresh();
</script>

<style scoped>
.ak-body {
  min-width: 680px;
}
.st-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.st-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  font-size: 12px;
}
.st-btn {
  padding: 4px 12px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  background: var(--vsc-bg-elevated);
  cursor: pointer;
  font-size: 12px;
}
.st-btn-add {
  border-color: #2ea043;
  color: #2ea043;
}
.ak-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ak-table th,
.ak-table td {
  border: 1px solid var(--vsc-border-weak);
  padding: 5px 8px;
  text-align: left;
}
.break {
  word-break: break-all;
}
.text-primary {
  color: var(--vsc-accent);
}
.text-danger {
  color: #a1260d;
}
.st-loading,
.st-empty {
  padding: 20px 0;
  text-align: center;
  color: var(--vsc-fg-muted);
  font-size: 12px;
}
</style>