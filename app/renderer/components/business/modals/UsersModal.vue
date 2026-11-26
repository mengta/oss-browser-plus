<template>
  <BaseModal :visible="true" :title="t('users.title')" :mask-closable="false" @close="onCancel">
    <div class="users-body" data-testid="users-modal">
      <div class="alert alert-success">
        {{ t('user.list.message.tip') }}
        <a href="https://ram.console.aliyun.com" @click.prevent="openURL('https://ram.console.aliyun.com')">https://ram.console.aliyun.com</a>
      </div>

      <div class="st-row">
        <input
          v-model="sch"
          type="text"
          class="st-input"
          :placeholder="t('ram.search.placeholder')"
          data-testid="users-search"
        />
        <button type="button" class="st-btn" data-testid="users-refresh" @click="refresh">
          {{ t('refresh') }}
        </button>
      </div>

      <div v-if="err" class="alert alert-danger">{{ err.message }}</div>

      <div v-if="isLoading" class="st-loading" data-testid="users-loading">{{ t('loading') }}</div>
      <div v-else-if="filtered.length === 0" class="st-empty" data-testid="users-empty">{{ t('no.data') }}</div>

      <table v-else class="users-table" data-testid="users-table">
        <tr>
          <th>{{ t('username') }}/{{ t('displayName') }}</th>
          <th>{{ t('comments') }}</th>
          <th>{{ t('lastModifyTime') }}</th>
          <th>{{ t('actions') }}</th>
        </tr>
        <tr v-for="item in filtered" :key="item.UserId" data-testid="users-row">
          <td class="break">
            <a href="javascript:;" data-testid="users-name" @click="showUpdate(item)">{{ item.UserName }}</a>
            <span v-if="item.DisplayName">({{ item.DisplayName }})</span>
          </td>
          <td>{{ truncate(item.Comments, 30) }}</td>
          <td>{{ formatDateTime(item.UpdateDate) }}</td>
          <td>
            <a href="javascript:;" class="text-primary" data-testid="users-update" @click="showUpdate(item)">{{ t('update') }}</a>
            |
            <a href="javascript:;" class="text-primary" data-testid="users-ak" @click="showAK(item)">{{ t('aks') }}</a>
            |
            <a href="javascript:;" class="text-danger" data-testid="users-remove" @click="showRemove(item)">{{ t('delete') }}</a>
          </td>
        </tr>
      </table>
    </div>

    <template #footer>
      <button type="button" class="st-btn" data-testid="users-close" @click="onCancel">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import ramClient from '../../../services/ram-client.js';
import { listFilter } from '../../../services/filters.js';
import { truncate, formatDateTime } from '../../../services/formatters.js';
import { useUiStore } from '../../../stores/ui.js';
import { useToastStore } from '../../../stores/toast.js';
import { api } from '../../../services/api.js';

// 等价 usersCtrl：列表/搜索/更新/AK/删除（解绑策略→删 AK→删用户，串行）
const emit = defineEmits(['close']);
const { t } = useI18n();
const ui = useUiStore();
const toast = useToastStore();

const items = ref([]);
const isLoading = ref(false);
const err = ref(null);
const sch = ref('');

const filtered = computed(() => deepFilter(items.value, sch.value));

function deepFilter(arr, keyword) {
  if (!keyword) {
    return arr;
  }
  return arr.filter((item) => {
    for (const key of ['UserName', 'DisplayName', 'Comments']) {
      if (item[key] && String(item[key]).indexOf(keyword) !== -1) {
        return true;
      }
    }
    return false;
  });
}

function openURL(url) {
  if (api && api.system && typeof api.system.openExternal === 'function') {
    api.system.openExternal(url);
  }
}

function refresh() {
  isLoading.value = true;
  err.value = null;
  ramClient
    .listUsers()
    .then((arr) => {
      isLoading.value = false;
      arr.sort((a, b) => (a.UpdateDate < b.UpdateDate ? 1 : -1));
      items.value = arr;
    })
    .catch((e) => {
      err.value = e;
      isLoading.value = false;
    });
}

function showUpdate(item) {
  ui.open('user-update', { item }).then(() => refresh());
}

function showAK(item) {
  ui.open('user-ak', { user: item }).then(() => refresh());
}

function showRemove(item) {
  const title = t('user.delete.title');
  const message = t('user.delete.message', { name: item.UserName });

  ui.confirm(title, message).then((b) => {
    if (!b) {
      return;
    }
    toast.push(t('user.delete.on'), 'info', 1000);
    ramClient
      .listPoliciesForUser(item.UserName)
      .then((result) => dig(result.Policies.Policy, (n) => ramClient.detachPolicyFromUser(n.PolicyName, item.UserName)))
      .then(() =>
        ramClient.listAccessKeys(item.UserName).then((result) =>
          dig(result.AccessKeys.AccessKey, (n) => ramClient.deleteAccessKey(item.UserName, n.AccessKeyId))
        )
      )
      .then(() => ramClient.deleteUser(item.UserName).then(() => {
        toast.push(t('user.delete.success'), 'success', 1000);
        refresh();
      }))
      .catch(() => {});
  });
}

function dig(arr, fn) {
  return arr.reduce((chain, n) => chain.then(() => fn(n)), Promise.resolve());
}

function onCancel() {
  emit('close');
}

refresh();
</script>

<style scoped>
.users-body {
  min-width: 640px;
}
.alert {
  padding: 8px 10px;
  font-size: 12px;
  margin-bottom: 10px;
  border-radius: 2px;
}
.alert-success {
  background: var(--vsc-success-bg);
  color: var(--vsc-success);
}
.alert-danger {
  background: var(--vsc-danger-bg);
  color: var(--vsc-danger);
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
.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.users-table th,
.users-table td {
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