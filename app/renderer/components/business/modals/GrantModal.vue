<template>
  <BaseModal :visible="true" :title="t('simplePolicy.title')" :mask-closable="false" @close="onClose">
    <form class="grant-form" data-testid="grant-modal" @submit.prevent="onSubmit">
      <div class="line">{{ t('simplePolicy.lb1.1') }}:</div>
      <ol class="resource">
        <li v-for="item in items" :key="item.name + (item.path || '')">{{ item.name }}</li>
      </ol>

      <div class="line">{{ t('simplePolicy.lb1.2') }}:</div>
      <div class="radios">
        <label v-for="p in privTypes" :key="p.value" class="radio-inline">
          <input v-model="privType" type="radio" :value="p.value" :data-testid="'grant-priv-' + p.value" @change="policyChange" />
          {{ t(p.key) }}
        </label>
      </div>

      <div class="line">
        <a href="javascript:void(0)" data-testid="grant-toggle-policy" @click="showPolicy = !showPolicy">
          [{{ t(showPolicy ? 'simplePolicy.lb3.2' : 'simplePolicy.lb3.1') }}]
        </a>
      </div>
      <textarea v-if="showPolicy" :value="policy" readonly rows="8" class="form-control policy" data-testid="grant-policy" />

      <div class="line">{{ t('simplePolicy.lb4') }}:</div>
      <input v-model="policyName" type="text" maxlength="128" class="form-control" data-testid="grant-policy-name" />
      <div v-if="policyName && !policyNameValid" class="text-danger">{{ t('simplePolicy.lb4') }}</div>

      <div class="line">{{ t('simplePolicy.lb5') }}:</div>
      <div class="row">
        <select v-model="toType" class="form-control type-select" data-testid="grant-to-type" @change="onTypeChange">
          <option value="user">{{ 'subusers' }}</option>
          <option value="group">{{ 'usergroups' }}</option>
          <option value="role">{{ 'roles' }}</option>
        </select>

        <select v-if="toType === 'user'" v-model="userName" class="form-control" :disabled="users.length === 0" data-testid="grant-user">
          <option value="">{{ t('new.user') }}</option>
          <option v-for="u in users" :key="u.UserName" :value="u.UserName">{{ u.UserName }}</option>
        </select>

        <select v-if="toType === 'group'" v-model="groupName" class="form-control" :disabled="groups.length === 0" data-testid="grant-group">
          <option value="">{{ groups.length === 0 ? t('nodata') : t('chooseone') }}</option>
          <option v-for="g in groups" :key="g.GroupName" :value="g.GroupName">{{ g.GroupName }}</option>
        </select>

        <select v-if="toType === 'role'" v-model="roleName" class="form-control" :disabled="roles.length === 0" data-testid="grant-role">
          <option value="">{{ roles.length === 0 ? t('nodata') : t('chooseone') }}</option>
          <option v-for="r in roles" :key="r.RoleName" :value="r.RoleName">{{ r.RoleName }}</option>
        </select>
      </div>

      <fieldset v-if="toType === 'user' && !userName" class="new-user" data-testid="grant-new-user">
        <div class="row">
          <label>{{ t('new.user.name') }}:</label>
          <input v-model="createName" type="text" class="form-control" placeholder="Sub User Name" data-testid="grant-new-name" />
          <button type="button" class="st-btn st-btn-success" data-testid="grant-new-random" @click="genUserName">
            {{ t('new.user.random.gen') }}
          </button>
        </div>
        <div class="row">
          <label>{{ t('new.user.email.send') }}:</label>
          <input
            v-model="createEmail"
            type="email"
            placeholder="Email"
            class="form-control"
            data-testid="grant-new-email"
            :disabled="!smtpFrom"
          />
        </div>
        <div v-if="!smtpFrom" class="text-danger">
          {{ t('new.user.email.noset') }}
          <a href="javascript:void(0)" data-testid="grant-open-settings" @click="openSettings">{{ t('new.user.email.noset.open') }}</a>
        </div>
      </fieldset>
    </form>
    <template #footer>
      <button type="submit" class="st-btn st-btn-success" data-testid="grant-submit" :disabled="!canSubmit" @click.prevent="onSubmit">
        {{ t('simplePolicy.ok') }}
      </button>
      <button type="button" class="st-btn" data-testid="grant-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 grant-modal（app/main/files/modals/grant-modal.js）：
// 资源/权限 → 生成 Policy 与策略名 → （可选）新建子用户+AK 并保存 → 创建/复用策略 →
// 授权给子用户（重试 3×1s）/用户组/角色 → Toast；新建用户时展示授权码弹窗并发送邮件。
// 偏差留痕：① 授权对象类型用 select 替代原版 dropdown（语义一致）；② 原版子用户 attach 失败递归无终止，
// 此处最多重试 3 次后报错；③ 语言包缺少 subusers/usergroups/roles 键，按原版缺翻译行为保持原文。
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import ramClient from '../../../services/ram-client.js';
import { ossClient } from '../../../services/oss-client.js';
import { userAkStore } from '../../../services/user-ak-store.js';
import { buildPolicy, buildPolicyName } from '../../../services/policy.js';
import { base64Encode } from '../../../services/base64.js';
import { api } from '../../../services/api.js';
import { REG } from '../../../services/const-data.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useSettingsStore } from '../../../stores/settings.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUiStore } from '../../../stores/ui.js';

const POLICY_NAME_REG = /^[a-z0-9A-Z-]{1,128}$/;

const props = defineProps({
  items: { type: Array, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const toast = useToastStore();
const ui = useUiStore();

const users = ref([]);
const groups = ref([]);
const roles = ref([]);
const privType = ref('readOnly');
const toType = ref('user');
const userName = ref('');
const groupName = ref('');
const roleName = ref('');
const policyName = ref('');
const policy = ref('');
const showPolicy = ref(false);
const createName = ref('');
const createEmail = ref('');
const submitting = ref(false);

const privTypes = [
  { value: 'readOnly', key: 'privilege.readonly' },
  { value: 'readWrite', key: 'privilege.readwrite' },
  { value: 'all', key: 'privilege.all' },
];

const smtpFrom = computed(() => (settingsStore.mailSmtp && settingsStore.mailSmtp.from) || '');
const policyNameValid = computed(() => POLICY_NAME_REG.test(policyName.value || ''));
const emailValid = computed(() => REG.EMAIL.test(createEmail.value || ''));
const canSubmit = computed(() => {
  if (!policyNameValid.value || submitting.value) return false;
  if (toType.value === 'user') {
    return !!userName.value || (!!createName.value && emailValid.value && !!smtpFrom.value);
  }
  if (toType.value === 'group') return !!groupName.value;
  return !!roleName.value;
});

function policyChange() {
  policy.value = JSON.stringify(buildPolicy(props.items, privType.value, props.currentInfo, 'grant'), null, 2);
  policyName.value = buildPolicyName(props.items, privType.value);
}

watch(privType, policyChange);

function genUserName() {
  createName.value = 'usr-' + new Date().getTime() + String(Math.random()).substring(2, 6);
}

onMounted(() => {
  policyChange();
  genUserName();

  ramClient
    .listUsers(true)
    .then((result) => {
      users.value = Array.isArray(result) ? result : [];
    })
    .catch((err) => {
      users.value = [];
      if (err && err.message && err.message.indexOf('You are not authorized to do this action') !== -1) {
        toast.push(t('simplePolicy.noauth.message1'), 'danger', 4000);
      }
    });

  ramClient
    .listGroups(true)
    .then((result) => {
      groups.value = Array.isArray(result) ? result : [];
    })
    .catch((err) => {
      groups.value = [];
      if (err && err.message && err.message.indexOf('You are not authorized to do this action') !== -1) {
        toast.push(t('simplePolicy.noauth.message2'), 'danger', 4000);
      }
    });

  ramClient
    .listRoles(true)
    .then((result) => {
      roles.value = Array.isArray(result) ? result : [];
    })
    .catch((err) => {
      roles.value = [];
      if (err && err.message && err.message.indexOf('You are not authorized to do this action') !== -1) {
        toast.push(t('simplePolicy.noauth.message3'), 'danger', 4000);
      }
    });
});

function onTypeChange() {
  userName.value = '';
  groupName.value = '';
  roleName.value = '';
}

function openSettings() {
  ui.open('settings');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resourceInfo() {
  const comments = [];
  let region = '';
  let bucket = '';
  for (const item of props.items || []) {
    if (item.itemType === 'bucket' || item.region) {
      region = item.region;
      bucket = item.name;
      comments.push('oss://' + item.name + '/');
    } else {
      region = props.currentInfo.region;
      bucket = props.currentInfo.bucket;
      comments.push('oss://' + props.currentInfo.bucket + '/' + item.path);
    }
  }
  return { region, bucket, comments };
}

async function buildSendInfo(id, secret, name, region, bucket) {
  const { comments } = resourceInfo();
  const eptpl = await ossClient
    .getOssEndpoint(region, bucket, (authStore.info && authStore.info.eptpl) || '')
    .catch(() => (authStore.info && authStore.info.eptpl) || '');
  const tokenInfo = {
    id,
    secret,
    desc: name,
    region,
    osspath: comments[0],
    eptpl,
  };
  const tokenStr = base64Encode(JSON.stringify(tokenInfo));

  return {
    subject: t('grant.email.title'),
    to: createEmail.value,
    html:
      t('grant.email.body.title') +
      '<br/><br/>' +
      '1. ' + t('auth.akLogin') + ':<br/><br/>' +
      'Sub User: ' + name + '<br/>' +
      'AccessKeyId: ' + id + '<br/>' +
      'AccessKeySecret: ' + secret + '<br/>' +
      'Region: ' + region + '<br/>' +
      'osspath: ' + comments.join(',<br/>') + '<br/>' +
      'permission: ' + privType.value + '<br/><br/>' +
      '2. ' + t('auth.tokenLogin') + ':<br/><br/>' +
      '<code style="word-wrap:break-word;">' + tokenStr + '</code><br/><hr/>',
  };
}

async function createSubUser() {
  const { region, bucket, comments } = resourceInfo();
  await ramClient.createUser({
    UserName: createName.value,
    Email: createEmail.value,
    Comments: (privType.value + ',' + comments.join(',')).substring(0, 100),
  });
  const akResult = await ramClient.createAccessKey(createName.value);
  const accessKey = (akResult && akResult.AccessKey) || akResult || {};
  await userAkStore.save({
    AccessKeyId: accessKey.AccessKeyId,
    AccessKeySecret: accessKey.AccessKeySecret,
    UserName: createName.value,
  });
  const refreshed = await ramClient.listUsers(true).catch(() => null);
  if (Array.isArray(refreshed)) users.value = refreshed;
  const sendInfo = await buildSendInfo(accessKey.AccessKeyId, accessKey.AccessKeySecret, createName.value, region, bucket);
  return { name: createName.value, sendInfo };
}

async function ensurePolicy() {
  try {
    const existing = await ramClient.getPolicy(policyName.value, 'Custom', true);
    return existing && existing.Policy;
  } catch (err) {
    const created = await ramClient.createPolicy(policyName.value, policy.value, t('simplePolicy.title'));
    return created && created.Policy;
  }
}

async function attachToUser(name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await ramClient.attachPolicyToUser(policyName.value, name);
      return;
    } catch (err) {
      await delay(1000);
    }
  }
  throw new Error('attach policy to user failed');
}

async function finish(sendInfo) {
  toast.push(t('simplePolicy.success'), 'success', 2000);
  if (sendInfo) {
    ui.open('grant-code', { info: sendInfo });
    toast.push(t('mail.send.on'), 'info', 1500);
    api.mail
      .send(settingsStore.mailSmtp, sendInfo)
      .then(() => toast.push(t('mail.test.success'), 'success', 2000))
      .catch((e) => toast.push((e && e.message) || 'send mail failed', 'danger', 4000));
  }
  emit('close', true);
}

async function onSubmit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    let sendInfo = null;
    let target = userName.value;

    if (toType.value === 'user' && !target) {
      const created = await createSubUser();
      target = created.name;
      sendInfo = created.sendInfo;
    }

    await ensurePolicy();

    if (toType.value === 'user') {
      await attachToUser(target);
    } else if (toType.value === 'group') {
      await ramClient.attachPolicyToGroup(policyName.value, groupName.value);
    } else {
      await ramClient.attachPolicyToRole(policyName.value, roleName.value);
    }

    await finish(sendInfo);
  } catch (err) {
    toast.push((err && err.message) || 'grant failed', 'danger', 4000);
  } finally {
    submitting.value = false;
  }
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.grant-form {
  min-width: 560px;
  max-width: 760px;
}
.line {
  margin: 8px 0 4px;
  color: var(--vsc-fg-muted);
}
.resource {
  margin: 0 0 8px;
  padding-left: 20px;
}
.radios {
  display: flex;
  gap: 14px;
  margin-bottom: 8px;
}
.radio-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: normal;
}
.form-control {
  width: 100%;
}
.policy {
  font-family: monospace;
  font-size: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
}
.row label {
  width: 110px;
  text-align: right;
  color: var(--vsc-fg-muted);
  font-weight: normal;
}
.type-select {
  flex: 0 0 140px;
}
.new-user {
  border-top: 1px dashed var(--vsc-border-weak);
  margin-top: 8px;
  padding-top: 4px;
}
.text-danger {
  color: var(--vsc-danger);
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
.st-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.st-btn-success {
  background: var(#2ea043);
  border-color: #2ea043;
  color: var(--vsc-on-accent);
}
</style>