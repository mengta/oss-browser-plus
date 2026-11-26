<template>
  <BaseModal :visible="true" :title="t('genAuthToken.title')" :mask-closable="false" @close="onClose">
    <form class="grant-token-form" data-testid="grant-token-modal" @submit.prevent="onSubmit">
      <div class="line">
        {{ t(item.isBucket ? 'genAuthToken.message1.1' : 'genAuthToken.message1.2') }}:
      </div>
      <ul class="resource">
        <li>{{ item.name }}</li>
      </ul>

      <div class="line">{{ t('genAuthToken.message2') }}</div>
      <div class="radios">
        <label v-for="p in privTypes" :key="p.value" class="radio-inline">
          <input v-model="privType" type="radio" :value="p.value" :data-testid="'grant-token-priv-' + p.value" @change="policyChange" />
          {{ t(p.key) }}
        </label>
      </div>

      <div class="line">
        <a href="javascript:void(0)" data-testid="grant-token-toggle-policy" @click="showPolicy = !showPolicy">
          [{{ t(showPolicy ? 'simplePolicy.lb3.2' : 'simplePolicy.lb3.1') }}]
        </a>
      </div>
      <textarea
        v-if="showPolicy"
        :value="policy"
        readonly
        rows="8"
        class="form-control policy"
        data-testid="grant-token-policy"
      />

      <div class="line">
        {{ t('effective.duration') }}({{ t('unit.second') }})
        <input
          v-model.number="durSeconds"
          type="number"
          min="900"
          max="43200"
          required
          class="form-control dur"
          data-testid="grant-token-duration"
        />
      </div>

      <div class="line">
        {{ t('genAuthToken.message3.1') }}:
        <small class="muted">{{ t('genAuthToken.message3.2', message5) }}</small>
        <a href="javascript:void(0)" :title="t('auth.authToken.tooltip')" @click="openRoleHelp">?</a>
      </div>
      <select v-model="roleArn" class="form-control" :disabled="roles.length === 0" data-testid="grant-token-role" required>
        <option value="">{{ roles.length === 0 ? t('nodata') : t('chooseone') }}</option>
        <option v-for="role in roles" :key="role.Arn" :value="role.Arn">{{ role.RoleName }}</option>
      </select>
      <small v-if="roles.length === 0">
        <a href="javascript:void(0)" data-testid="grant-token-create-role" @click="openRoleConsole">{{ t('goto.create.role') }}</a>
      </small>

      <div v-if="token" class="token-block" data-testid="grant-token-result">
        <div class="line success">{{ t('genAuthToken.message4') }}:</div>
        <div class="token-row">
          <input :value="token" readonly type="text" class="form-control" data-testid="grant-token-value" />
          <CopyButton :text="token" :title="t('click.copy')">{{ t('click.copy') }}</CopyButton>
        </div>
        <small class="muted">({{ t('genAuthToken.message5', message5) }})</small>
      </div>
    </form>
    <template #footer>
      <button type="submit" class="st-btn st-btn-success" data-testid="grant-token-submit" :disabled="!canSubmit" @click.prevent="onSubmit">
        {{ t(token ? 'genAuthToken.message6.2' : 'genAuthToken.message6.1') }}
      </button>
      <button type="button" class="st-btn" data-testid="grant-token-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 grant-token-modal（app/main/files/modals/grant-token-modal.js）：
// 权限策略（readOnly/readWrite/all）→ STS assumeRole（角色 + 有效时长 900-43200）→
// base64 授权码（id/secret/securityToken/expiration/region/osspath/privilege/eptpl）+ 复制。
// 日期使用 dayjs（formatDateTime），替代原版 moment。
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import CopyButton from '../../base/CopyButton.vue';
import { ossClient } from '../../../services/oss-client.js';
import ramClient from '../../../services/ram-client.js';
import { stsClient } from '../../../services/sts-client.js';
import { buildPolicy } from '../../../services/policy.js';
import { base64Encode } from '../../../services/base64.js';
import { formatDateTime } from '../../../services/formatters.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useToastStore } from '../../../stores/toast.js';

const props = defineProps({
  item: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const authStore = useAuthStore();
const toast = useToastStore();

const roles = ref([]);
const privType = ref('readOnly');
const policy = ref('');
const durSeconds = ref(3600);
const roleArn = ref('');
const token = ref('');
const originToken = ref(null);
const showPolicy = ref(false);
const expiration = ref('');

const privTypes = [
  { value: 'readOnly', key: 'privilege.readonly' },
  { value: 'readWrite', key: 'privilege.readwrite' },
  { value: 'all', key: 'privilege.all' },
];

const message5 = computed(() => ({
  object: props.item.name,
  type: props.item.isBucket ? 'Bucket' : t('folder'),
  privilege: t('privilege.' + privType.value.toLowerCase()),
  expiration: expiration.value,
}));

const canSubmit = computed(() => !!roleArn.value && durSeconds.value >= 900 && durSeconds.value <= 43200);

function policyChange() {
  policy.value = JSON.stringify(buildPolicy([props.item], privType.value, props.currentInfo, 'token'), null, 2);
}

watch(privType, policyChange);

onMounted(() => {
  policyChange();
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

function openExternal(url) {
  const system = typeof window !== 'undefined' && window.ossBrowser ? window.ossBrowser.system : null;
  if (system && typeof system.openExternal === 'function') {
    system.openExternal(url).catch(() => {});
  }
}

function openRoleHelp() {
  openExternal('https://help.aliyun.com/document_detail/28649.html');
}

function openRoleConsole() {
  openExternal('https://ram.console.aliyun.com/#/role/list');
}

function onSubmit() {
  if (!canSubmit.value) return;
  const info = props.currentInfo || {};
  const item = props.item || {};
  const region = item.region || info.region;
  const bucket = item.region ? item.name : info.bucket;
  const key = item.path || '';
  const eptpl = (authStore.info && authStore.info.eptpl) || '';

  stsClient
    .assumeRole(roleArn.value, policy.value, durSeconds.value)
    .then(async (result) => {
      originToken.value = result;
      const credentials = (result && result.Credentials) || {};
      const effectiveEptpl = await ossClient.getOssEndpoint(region, bucket, eptpl).catch(() => eptpl);
      const tokenInfo = {
        id: credentials.AccessKeyId,
        secret: credentials.AccessKeySecret,
        stoken: credentials.SecurityToken,
        expiration: credentials.Expiration,
        region,
        osspath: 'oss://' + bucket + '/' + key,
        privilege: privType.value,
        eptpl: effectiveEptpl,
      };
      token.value = base64Encode(JSON.stringify(tokenInfo));
      expiration.value = credentials.Expiration ? formatDateTime(credentials.Expiration) : '';
    })
    .catch((err) => {
      toast.push((err && err.message) || 'assume role failed', 'danger', 4000);
    });
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.grant-token-form {
  min-width: 520px;
  max-width: 720px;
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
.dur {
  width: 140px;
}
.muted {
  color: var(--vsc-fg-muted);
}
.success {
  color: var(--vsc-success);
}
.token-block {
  margin-top: 10px;
}
.token-row {
  display: flex;
  align-items: center;
  gap: 6px;
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