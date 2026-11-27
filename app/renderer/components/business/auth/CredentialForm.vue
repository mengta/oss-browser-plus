<template>
  <form class="credential-form" data-testid="credential-form" @submit.prevent="onFormSubmit" @input="emit('input-change')" @change="emit('input-change')">
    <div class="cf-row">
      <label class="cf-label" :class="{ 'cf-error-text': touched && errors.endpoint }">
        <span class="red">*</span> Endpoint:
        <HintTooltip class="cf-pop" data-testid="login-eptpl-help" :text="t('auth.eptpl.popup.msg1') + ' ' + t('auth.eptpl.popup.msg2')" />
      </label>
      <div class="cf-endpoint">
        <select :value="eptplType" class="cf-plain" data-testid="login-endpoint-type" @change="onEndpointTypeChange($event.target.value)">
          <option value="default">{{ t('default') }} ({{ t('public.cloud') }})</option>
          <option value="customize">{{ t('customize') }}</option>
          <option value="cname">cname</option>
          <option value="privateLink">{{ t('privateLink') }}</option>
        </select>
        <label v-if="eptplType === 'default'" class="cf-inline" data-testid="login-secure">
          <input type="checkbox" :checked="secure === 'YES'" @change="$emit('update:secure', $event.target.checked ? 'YES' : 'NO')" />
          {{ t('auth.secure') }}
        </label>
        <input
          v-if="eptplType === 'customize'"
          v-model="local.eptpl"
          type="text"
          class="cf-plain"
          :class="{ 'cf-invalid': touched && errors.endpoint }"
          placeholder="http(s)://"
          data-testid="login-endpoint"
        />
        <input
          v-if="eptplType === 'cname'"
          v-model="local.eptplcname"
          type="text"
          class="cf-plain"
          :class="{ 'cf-invalid': touched && errors.endpoint }"
          placeholder="http(s)://"
          data-testid="login-cname"
        />
        <input
          v-if="eptplType === 'privateLink'"
          v-model="local.privateLink"
          type="text"
          class="cf-plain"
          :class="{ 'cf-invalid': touched && errors.endpoint }"
          placeholder="http(s)://"
          data-testid="login-privatelink"
        />
      </div>
    </div>

    <div class="cf-row">
      <label class="cf-label" :class="{ 'cf-error-text': touched && errors.id }">
        <span class="red">*</span> AccessKeyId:
      </label>
      <input
        v-model="local.id"
        type="text"
        class="cf-plain"
        :class="{ 'cf-invalid': touched && errors.id }"
        placeholder="AccessKeyId"
        data-testid="login-id"
      />
    </div>

    <div class="cf-row">
      <label class="cf-label" :class="{ 'cf-error-text': touched && errors.secret }">
        <span class="red">*</span> AccessKeySecret:
      </label>
      <input
        v-model="local.secret"
        type="password"
        class="cf-plain"
        :class="{ 'cf-invalid': touched && errors.secret }"
        placeholder="AccessKeySecret"
        data-testid="login-secret"
      />
    </div>

    <div v-if="isSts" class="cf-row">
      <label class="cf-label" :class="{ 'cf-error-text': touched && errors.stoken }"> STS Token: </label>
      <input
        v-model="local.stoken"
        type="text"
        class="cf-plain"
        :class="{ 'cf-invalid': touched && errors.stoken }"
        placeholder="SecurityToken"
        data-testid="login-stoken"
      />
    </div>

    <div class="cf-row">
      <label class="cf-label" :class="{ 'cf-error-text': touched && errors.osspath }">
        {{ t('auth.presetOssPath') }}:
        <HintTooltip class="cf-pop" data-testid="login-osspath-help" :text="t('auth.presetOssPath.popup.msg1') + ' ' + t('auth.presetOssPath.popup.msg2')" />
      </label>
      <input
        v-model="local.osspath"
        type="text"
        class="cf-plain"
        :class="{ 'cf-invalid': touched && errors.osspath }"
        :placeholder="t('auth.presetOssPath.placeholder')"
        data-testid="login-osspath"
      />
    </div>

    <div v-if="showRegion" class="cf-row">
      <label class="cf-label" :class="{ 'cf-error-text': touched && errors.region }"> {{ t('region') }}: </label>
      <select v-model="local.region" class="cf-plain" data-testid="login-region">
        <option v-for="rg in regions" :key="rg.id" :value="rg.id">{{ t('region.' + rg.id) }}</option>
      </select>
    </div>

    <div class="cf-row">
      <label class="cf-label">{{ t('auth.description') }}:</label>
      <input
        v-model="local.desc"
        type="text"
        maxlength="30"
        class="cf-plain"
        :placeholder="t('auth.description.placeholder')"
        data-testid="login-desc"
      />
    </div>

    <div class="cf-flags" data-testid="login-flags">
      <label class="cf-inline">
        <input type="checkbox" :checked="keepLoggedIn" data-testid="login-keep-logged-in" @change="$emit('update:keepLoggedIn', $event.target.checked)" />
        {{ t('auth.keepLoggedIn') }}
      </label>
      <label class="cf-inline">
        <input
          type="checkbox"
          :checked="remember"
          data-testid="login-remember"
          @change="$emit('update:remember', $event.target.checked)"
        />
        {{ t('auth.remember') }}
        <HintTooltip class="cf-pop" data-testid="login-remember-help" :text="t('auth.remember.popup.msg1')" />
      </label>
      <label class="cf-inline" data-testid="login-requestpay">
        <input
          type="checkbox"
          :checked="requestpay === 'YES'"
          @change="onRequestPayChange($event.target.checked ? 'YES' : 'NO')"
        />
        {{ t('requestPay') }}
        <HintTooltip
          class="cf-pop"
          data-testid="login-requestpay-help"
          :text="t('requestpay.popup.msg')"
          link-url="https://help.aliyun.com/document_detail/91337.html"
        />
      </label>
    </div>

    <slot name="footer" />
  </form>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { regions } from '../../../services/constants.js';
import HintTooltip from '../../base/HintTooltip.vue';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  endpointType: { type: String, default: 'default' },
  remember: { type: Boolean, default: false },
  keepLoggedIn: { type: Boolean, default: true },
  secure: { type: String, default: 'YES' },
});

const emit = defineEmits([
  'update:modelValue',
  'update:endpointType',
  'update:remember',
  'update:keepLoggedIn',
  'update:secure',
  'input-change',
  'submit',
]);

const { t } = useI18n();

const DEF_EP_TPL = 'http://{region}.aliyuncs.com';
const EP_PATTERN = /^http(s)?:\/\//;
const OSS_PATTERN = /^oss:\/\//;

const local = reactive({
  id: '',
  secret: '',
  stoken: '',
  region: '',
  eptpl: DEF_EP_TPL,
  eptplcname: '',
  privateLink: '',
  cname: false,
  osspath: '',
  desc: '',
});

for (const key of Object.keys(local)) {
  if (props.modelValue && props.modelValue[key] !== undefined) {
    local[key] = props.modelValue[key] || '';
  }
}
if (props.endpointType === 'default' && !props.modelValue.eptpl) {
  local.eptpl = props.secure === 'NO' ? 'http://{region}.aliyuncs.com' : 'https://{region}.aliyuncs.com';
}

// 外部回填（AK 历史 / 一键导入）由父组件经 ref 显式调用 applyExternal，
// 避免 watch(modelValue) 与 emit 回流之间的旧快照竞态（实测会覆盖最新 local 值）。
function applyExternal(patch) {
  for (const key of Object.keys(local)) {
    if (patch && patch[key] !== undefined) {
      local[key] = patch[key] || '';
    }
  }
}

const eptplType = computed(() => props.endpointType);

const isSts = computed(() => String(local.id || '').indexOf('STS.') === 0);
const requestpay = ref(localStorage.getItem('show-request-pay') || 'NO');
const touched = ref(false);

const showRegion = computed(
  () => !!local.osspath && String(local.eptpl || '').indexOf('{region}') !== -1
);

const errors = computed(() => {
  const e = {};
  if (!String(local.id || '').trim()) e.id = true;
  if (!String(local.secret || '').trim()) e.secret = true;
  if (isSts.value && !String(local.stoken || '').trim()) e.stoken = true;
  const oss = String(local.osspath || '');
  if (oss && !OSS_PATTERN.test(oss)) e.osspath = true;
  if (eptplType.value === 'customize' && !EP_PATTERN.test(String(local.eptpl || ''))) e.endpoint = true;
  if (eptplType.value === 'cname' && !EP_PATTERN.test(String(local.eptplcname || ''))) e.endpoint = true;
  if (eptplType.value === 'privateLink' && !EP_PATTERN.test(String(local.privateLink || ''))) e.endpoint = true;
  if (showRegion.value && !local.region) e.region = true;
  return e;
});

// 等价原 loginCtrl.eptplChange：切换端点类型时重置对应字段
// （change 事件直接携带目标值，避免父级 props 更新时序导致的旧值读取）
function onEndpointTypeChange(value) {
  emit('update:endpointType', value);

  if (value === 'default') {
    local.cname = false;
    local.eptpl = props.secure === 'YES' ? 'https://{region}.aliyuncs.com' : DEF_EP_TPL;
  } else if (value === 'customize') {
    local.cname = false;
    local.eptpl = '';
  } else if (value === 'cname') {
    local.cname = true;
    local.eptplcname = '';
  } else if (value === 'privateLink') {
    local.privateLink = '';
    local.eptpl = '';
    local.cname = false;
  }
}

// 等价原 loginCtrl 的 $watch('flags.secure')：default 模式下替换 eptpl 协议前缀并持久化
watch(
  () => props.secure,
  (v) => {
    try {
      localStorage.setItem('show-secure', v);
    } catch (err) {
      // 存储不可用时仅内存生效
    }
    if (props.endpointType === 'default') {
      local.eptpl = String(local.eptpl || DEF_EP_TPL).replace(/^https?/, v === 'YES' ? 'https' : 'http');
    }
  }
);

function onRequestPayChange(value) {
  requestpay.value = value;
  try {
    localStorage.setItem('show-request-pay', value);
  } catch (err) {
    // 存储不可用时仅内存生效
  }
}

watch(
  local,
  () => {
    emit('update:modelValue', Object.assign({}, local, { osspath_isdir: false }));
  },
  { deep: true }
);

function onFormSubmit() {
  emit('submit');
}

// 等价原 form1.$valid 校验：返回是否可提交，同时点亮错误红框
function validate() {
  touched.value = true;
  return Object.keys(errors.value).length === 0;
}

defineExpose({ validate, applyExternal });
</script>

<style scoped>
.credential-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cf-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cf-label {
  width: 118px;
  text-align: right;
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
.cf-plain {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
}
.cf-invalid {
  border-color: var(--vsc-danger);
  background: var(--vsc-danger-bg);
}
.cf-error-text {
  color: var(--vsc-danger);
}
.cf-endpoint {
  display: flex;
  flex: 1;
  gap: 8px;
  align-items: center;
}
.cf-endpoint select {
  min-width: 150px;
}
.cf-endpoint input {
  flex: 1;
  min-width: 0;
}
.cf-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--vsc-fg-muted);
  white-space: nowrap;
}
.cf-pop {
  display: inline-block;
  width: 14px;
  height: 14px;
  line-height: 14px;
  border-radius: 50%;
  background: var(--vsc-bg-input);
  color: var(--vsc-fg);
  border: 1px solid var(--vsc-border);
  box-sizing: border-box;
  font-size: 11px;
  text-align: center;
  cursor: help;
}
.cf-flags {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 12px;
}
.red {
  color: var(--vsc-danger);
}
</style>