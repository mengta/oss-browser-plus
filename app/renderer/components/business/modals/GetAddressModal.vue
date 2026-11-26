<template>
  <BaseModal :visible="true" :title="t('getAddress.title')" :mask-closable="false" @close="onClose">
    <form class="address-form" data-testid="get-address-modal" @submit.prevent="onGenerate">
      <div class="form-group">
        <label>{{ t('name') }}:</label>
        <input :value="item.name" type="text" readonly class="form-control" data-testid="address-name" />
      </div>

      <div v-if="customDomainList.length" class="form-group">
        <label for="address-domain">{{ t('custom_domain') }}:</label>
        <select
          id="address-domain"
          v-model="customDomain"
          class="form-control"
          data-testid="address-domain"
          @change="onDomainChange"
        >
          <option v-for="d in customDomainList" :key="d.label" :value="d.value">{{ d.label }}</option>
        </select>
      </div>

      <div v-if="isLoading" class="loading">{{ t('loading') }}</div>

      <div v-if="!isLoading && step === 1" class="form-group" data-testid="address-ready">
        <label>{{ t('address') }}:</label>
        <div class="value row">
          <input v-model="url" type="text" class="form-control" data-testid="address-url" />
          <CopyButton :text="url" :title="t('click.copy')">{{ t('click.copy') }}</CopyButton>
          <button type="button" class="st-btn" data-testid="address-toggle-send" @click="showSendTo = !showSendTo">
            {{ t('send.email') }}
          </button>
        </div>
      </div>

      <div v-if="!isLoading && step === 2" class="form-group" data-testid="address-sign">
        <label>{{ t('address') }}:</label>
        <div v-if="!url" class="value row">
          <span>{{ t('getAddress.message') }}:</span>
          <input
            v-model.number="sec"
            type="number"
            data-testid="address-sec"
            required
            class="form-control sec-input"
          />
          <span>{{ t('unit.second') }}</span>
          <button type="button" class="st-btn st-btn-success" data-testid="address-generate" @click="onGenerate">
            {{ t('generate') }}
          </button>
        </div>
        <div v-else class="value row">
          <input v-model="url" type="text" class="form-control" data-testid="address-signed-url" />
          <CopyButton :text="url" :title="t('click.copy')">{{ t('click.copy') }}</CopyButton>
          <button type="button" class="st-btn" data-testid="address-toggle-send" @click="showSendTo = !showSendTo">
            {{ t('send.email') }}
          </button>
        </div>
      </div>

      <div v-if="!isLoading && step === 3" class="alert alert-danger" data-testid="address-error">
        {{ err }}
      </div>

      <div v-if="url" class="alert alert-warning">{{ t('file.download.warning') }}</div>
      <div v-if="url" class="qr-wrap" data-testid="address-qrcode">
        <QrCodeCard ref="qrRef" :text="url" :width="300" :height="300">{{ t('qrcode.download') }}</QrCodeCard>
      </div>

      <div v-if="showSendTo && url" class="form-group" data-testid="address-send-row">
        <label for="address-email">{{ t('send.to') }}:</label>
        <div class="value row">
          <input
            id="address-email"
            v-model="mailTo"
            type="email"
            placeholder="Email"
            class="form-control"
            data-testid="address-email"
          />
          <button
            type="button"
            class="st-btn st-btn-primary"
            data-testid="address-send"
            :disabled="!emailValid"
            @click="sendTo"
          >
            {{ t('send.now') }}
          </button>
        </div>
      </div>
    </form>
    <template #footer>
      <button type="button" class="st-btn" data-testid="address-close" @click="onClose">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
// 等价 get-address（app/main/files/modals/get-address.{js,html}）：
// 打开探测对象可访问性（200→step1 直接展示；403→step2 生成签名链接；其他→step3 错误），
// 支持自有/加速域名切换（localStorage _lastSelectedDomain 记忆）、复制链接、邮件分享。
// 偏差留痕：① 原版探测源 item.url 在列表 DTO 中为空（渲染层未生成），改为 item.url 缺失时直接进入 step2；
// ② 二维码由 B3-13 QrCodeCard 承接（jquery.qrcode 按 D-12 移除）。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import CopyButton from '../../base/CopyButton.vue';
import QrCodeCard from '../../base/QrCodeCard.vue';
import { ossClient } from '../../../services/oss-client.js';
import { api } from '../../../services/api.js';
import { REG } from '../../../services/const-data.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useSettingsStore } from '../../../stores/settings.js';
import { useToastStore } from '../../../stores/toast.js';

const LAST_DOMAIN_KEY = '_lastSelectedDomain';

const props = defineProps({
  item: { type: Object, required: true },
  currentInfo: { type: Object, required: true },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const toast = useToastStore();

const isLoading = ref(true);
const step = ref(2);
const err = ref('');
const sec = ref(3600);
const originUrl = ref('');
const url = ref('');
const customDomain = ref(undefined);
const customDomainList = ref([]);
const mailTo = ref('');
const showSendTo = ref(false);
const qrRef = ref(null);

const emailValid = computed(() => REG.EMAIL.test(mailTo.value || '') && !!url.value);

function applyDomain() {
  if (!originUrl.value) {
    url.value = '';
    return;
  }
  url.value = customDomain.value
    ? originUrl.value.replace(/\/\/[^/]+\//, '//' + customDomain.value + '/')
    : originUrl.value;

}

async function probe(target) {
  try {
    // P3（R-P3-04）：net-bridge 统一返回 { ok, data }，data 为 { status, ok, body }
    const res = await ossClient.probeUrl(target);
    const data = res && res.ok ? res.data : null;
    if (!data) {
      step.value = 2;
      return;
    }
    if (data.ok) {
      originUrl.value = target;
      applyDomain();
      step.value = 1;
    } else if (data.status === 403) {
      step.value = 2;
    } else {
      err.value = data.body || String(data.status);
      step.value = 3;
    }
  } catch (e) {
    // 网络不可达/超时/通道异常时不阻断获取地址：直接进入签名链接步骤
    step.value = 2;
  }
}

async function loadDomains() {
  const info = props.currentInfo || {};
  try {
    const tasks = [ossClient.listUsableAccelarateDomains(info.bucket)];
    if (!(authStore.info && authStore.info.cname)) {
      tasks.push(ossClient.listAllCustomDomains(info.bucket));
    } else {
      tasks.push(Promise.resolve([]));
    }
    const [accListRaw, cnameListRaw] = await Promise.all(tasks);
    const cnameList = Array.isArray(cnameListRaw) ? cnameListRaw : [];
    const accList = Array.isArray(accListRaw) ? accListRaw : [];
    if (cnameList.length === 0 && accList.length === 0) {
      customDomainList.value = [];
      return;
    }
    const list = [{ label: t('not_use_own_domain'), value: undefined }]
      .concat(cnameList.map((domain) => ({ label: domain, value: domain })))
      .concat(accList.map((domain) => ({ label: info.bucket + '.' + domain, value: info.bucket + '.' + domain })));
    customDomainList.value = list;

    const candidates = list.map((d) => d.value);
    let last = null;
    try {
      last = localStorage.getItem(LAST_DOMAIN_KEY);
    } catch (e) {
      last = null;
    }
    if (last && candidates.indexOf(last) >= 0) {
      customDomain.value = last;
      applyDomain();
    }
  } catch (e) {
    customDomainList.value = [];
  }
}

onMounted(async () => {
  const target = props.item.url;
  // 仅探测外网 http(s) 地址；oss:// 或空 url 直接进入签名链接步骤，避免主进程 invalid url
  if (target && /^https?:\/\//i.test(String(target))) {
    await probe(target);
  } else {
    step.value = 2;
  }
  await loadDomains();
  isLoading.value = false;
});

function onDomainChange() {
  try {
    localStorage.setItem(LAST_DOMAIN_KEY, customDomain.value || '');
  } catch (e) {
    /* 存储不可用时仅内存态 */
  }
  applyDomain();
}

function onGenerate() {
  const info = props.currentInfo || {};
  const seconds = Number(sec.value) || 0;
  if (seconds <= 0) return;
  ossClient
    .signatureUrl2(info.region, info.bucket, props.item.path, seconds)
    .then((signed) => {
      originUrl.value = signed;
      applyDomain();
    })
    .catch((e) => {
      toast.push((e && e.message) || 'sign url failed', 'danger', 4000);
    });
}

function sendTo() {
  if (!emailValid.value) return;
  const name = props.item.name;
  const smtp = settingsStore.mailSmtp || {};
  const parts = [
    t('click.download') + ': <a href="' + url.value + '" target="_blank">' + name + '</a>',
    t('qrcode.download') + ':',
  ];
  const qrData = qrRef.value && typeof qrRef.value.toDataURL === 'function' ? qrRef.value.toDataURL() : '';
  if (qrData) {
    parts.push('<img src="' + qrData + '" style="width:300px;height:300px"/>');
  }
  toast.push(t('mail.send.on'), 'info', 1500);
  api.mail
    .send(smtp, {
      subject: t('file.download.address') + ':[' + name + ']',
      to: mailTo.value,
      html: parts.join('<br/>'),
    })
    .then(() => toast.push(t('mail.test.success'), 'success', 2000))
    .catch((e) => toast.push((e && e.message) || 'send mail failed', 'danger', 4000));
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.address-form {
  min-width: 520px;
  max-width: 720px;
}
.form-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.form-group > label {
  width: 110px;
  text-align: right;
  color: var(--vsc-fg-muted);
}
.value {
  flex: 1;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.form-control {
  flex: 1;
  min-width: 160px;
}
.sec-input {
  flex: 0 0 90px;
  min-width: 90px;
}
.loading {
  color: var(--vsc-fg-muted);
  padding: 6px 0;
}
.alert {
  padding: 8px 12px;
  border-radius: 2px;
  margin: 8px 0;
  font-size: 12px;
}
.alert-danger {
  background: var(--vsc-danger-bg);
  color: var(--vsc-danger);
}
.alert-warning {
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
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
  background: var(--vsc-success-solid);
  border-color: var(--vsc-success);
  color: var(--vsc-on-accent);
}
.st-btn-primary {
  background: var(--vsc-accent);
  border-color: var(--vsc-accent-hover);
  color: var(--vsc-on-accent);
}
</style>