<template>
  <div class="sub-address-bar" data-testid="sub-address-bar">
    <button
      type="button"
      class="btn-icon"
      data-testid="sub-address-back"
      :disabled="!canGoBack"
      @click="goBack"
    >
      <AppIcon name="chevron-left" />
    </button>
    <button
      type="button"
      class="btn-icon"
      data-testid="sub-address-ahead"
      :disabled="!canGoAhead"
      @click="goAhead"
    >
      <AppIcon name="chevron-right" />
    </button>
    <button
      type="button"
      class="btn-icon"
      data-testid="sub-address-go-up"
      @click="goUp"
    >
      <AppIcon name="arrow-up" />
    </button>
    <form class="address-form" @submit.prevent="subGo">
      <input
        v-model="subAddress"
        type="text"
        class="form-control"
        data-testid="sub-address-input"
        placeholder="/"
        spellcheck="false"
      />
    </form>
  </div>
</template>

<script setup>
// 等价 sub-address-bar（app/main/files/_/sub-address-bar.js）：
// 授权根路径（DEF_ADDR = auth.info.osspath）下的相对路径输入与历史导航。
// 注意：与 Angular 版一致，当前版本 FilesPage 未挂载本组件（原版 files.html 中已注释禁用），
// 本实现保持语义等价以备 STS 授权登录场景启用。
import { ref, onMounted } from 'vue';
import AppIcon from '../../base/AppIcon.vue';
import { useFilesStore } from '../../../stores/files.js';
import { useAuthStore } from '../../../stores/auth.js';

const filesStore = useFilesStore();
const authStore = useAuthStore();

const DEF_ADDR = (authStore.info && authStore.info.osspath) || 'oss://';
const address = ref(DEF_ADDR);
const subAddress = ref('/');
const canGoBack = ref(false);
const canGoAhead = ref(false);
const hist = { arr: [], index: -1 };

function histUpdate() {
  canGoBack.value = hist.index > 0;
  canGoAhead.value = hist.index < hist.arr.length - 1;
}

function histAdd(addr) {
  if (hist.arr[hist.index] === addr) return;
  hist.arr = hist.arr.slice(0, hist.index + 1);
  hist.arr.push(addr);
  hist.index = hist.arr.length - 1;
  histUpdate();
}

function ensureLeadingSlash(raw) {
  const s = String(raw == null ? '' : raw);
  if (!s) return '/';
  return s.indexOf('/') === 0 ? s : '/' + s;
}

function subGo() {
  subAddress.value = ensureLeadingSlash(subAddress.value);
  const addr = DEF_ADDR.replace(/\/+$/, '') + subAddress.value;
  address.value = addr;
  histAdd(addr);
  filesStore.navigate(addr);
}

function syncSub(addr) {
  if (addr.indexOf(DEF_ADDR) === 0) {
    subAddress.value = ensureLeadingSlash(addr.slice(DEF_ADDR.length) || '/');
  } else {
    subAddress.value = ensureLeadingSlash(addr);
  }
}

function goBack() {
  if (!canGoBack.value) return;
  hist.index--;
  address.value = hist.arr[hist.index];
  syncSub(address.value);
  histUpdate();
  filesStore.navigate(address.value);
}

function goAhead() {
  if (!canGoAhead.value) return;
  hist.index++;
  address.value = hist.arr[hist.index];
  syncSub(address.value);
  histUpdate();
  filesStore.navigate(address.value);
}

function goUp() {
  const rest = address.value.slice(6).replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = rest.split('/');
  parts.pop();
  const next = parts.length ? 'oss://' + parts.join('/') + '/' : 'oss://';
  address.value = next;
  syncSub(next);
  subGo();
}

onMounted(() => {
  address.value = DEF_ADDR;
  syncSub(DEF_ADDR);
});

defineExpose({ setAddress: function (addr) { address.value = addr; syncSub(addr); } });
</script>

<style scoped>
.sub-address-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vsc-border-weak);
}
.address-form {
  flex: 1;
  min-width: 0;
}
.form-control {
  width: 100%;
  box-sizing: border-box;
}
.btn-icon {
  border: none;
  background: none;
  padding: 4px 6px;
  cursor: pointer;
  line-height: 1;
  color: var(--vsc-fg-muted);
}
.btn-icon:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
</style>