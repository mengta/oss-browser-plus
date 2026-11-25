<template>
  <div class="address-bar" data-testid="address-bar">
    <button
      type="button"
      class="btn-icon"
      data-testid="address-back"
      :disabled="!canGoBack"
      :title="t('common.back') || 'Back'"
      @click="goBack"
    >
      <AppIcon name="chevron-left" />
    </button>
    <button
      type="button"
      class="btn-icon"
      data-testid="address-ahead"
      :disabled="!canGoAhead"
      :title="t('common.ahead') || 'Ahead'"
      @click="goAhead"
    >
      <AppIcon name="chevron-right" />
    </button>
    <button
      type="button"
      class="btn-icon"
      data-testid="address-go-up"
      title="Up"
      @click="goUp"
    >
      <AppIcon name="arrow-up" />
    </button>
    <form class="address-form" @submit.prevent="go">
      <input
        v-model="address"
        type="text"
        class="form-control"
        data-testid="address-input"
        placeholder="oss://"
        spellcheck="false"
      />
    </form>
    <button
      type="button"
      class="btn-icon"
      data-testid="address-fav"
      :class="{ active: isFav }"
      :title="isFav ? 'Remove favorite' : 'Add favorite'"
      @click="toggleFav"
    >
      <AppIcon name="star" />
    </button>
  </div>
</template>

<script setup>
// 等价 Angular address-bar（app/main/files/_/address-bar.js）：
// oss:// 地址输入（getAddress 修正）、自维护历史栈（去重/截断前进/上限 historiesLength）、
// goUp 多级回退（根时刷新）、收藏星标；地址变更直接驱动 filesStore.navigate
// （等价 ossAddressChange → filesCtrl.parseOSSPath 事件流）。
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from '../../base/AppIcon.vue';
import { useFilesStore } from '../../../stores/files.js';
import { useFavoritesStore } from '../../../stores/favorites.js';
import { useSettingsStore } from '../../../stores/settings.js';
import { useToastStore } from '../../../stores/toast.js';
import { useAuthStore } from '../../../stores/auth.js';

const { t } = useI18n();
const filesStore = useFilesStore();
const favoritesStore = useFavoritesStore();
const settingsStore = useSettingsStore();
const toastStore = useToastStore();
const authStore = useAuthStore();

const address = ref('oss://');
const canGoBack = ref(false);
const canGoAhead = ref(false);

// 历史栈（等价 His 闭包：arr + index）
const hist = { arr: [], index: -1 };

function histUpdate() {
  canGoBack.value = hist.index > 0;
  canGoAhead.value = hist.index < hist.arr.length - 1;
}

function histAdd(addr) {
  const limit = settingsStore.historiesLength || 100;
  if (hist.arr[hist.index] === addr) {
    return;
  }
  // 截断前进分支（等价 js:55）
  hist.arr = hist.arr.slice(0, hist.index + 1);
  hist.arr.push(addr);
  while (hist.arr.length > limit) {
    hist.arr.shift();
  }
  hist.index = hist.arr.length - 1;
  histUpdate();
}

function getAddress(raw) {
  let addr = String(raw == null ? '' : raw).trim();
  if (!addr) {
    addr = 'oss://';
  }
  if (addr.indexOf('oss://') !== 0) {
    addr = addr.replace(/^\/+/, '').replace(/\/+$/, '');
    addr = addr ? 'oss://' + addr + '/' : 'oss://';
  }
  return addr;
}

function navigate(addr) {
  filesStore.navigate(addr);
}

function go() {
  const addr = getAddress(address.value);
  address.value = addr;
  histAdd(addr);
  navigate(addr);
}

function goBack() {
  if (!canGoBack.value) return;
  hist.index--;
  address.value = hist.arr[hist.index];
  histUpdate();
  navigate(address.value);
}

function goAhead() {
  if (!canGoAhead.value) return;
  hist.index++;
  address.value = hist.arr[hist.index];
  histUpdate();
  navigate(address.value);
}

// 等价 goUp：根地址直接 go() 刷新；否则 pop 一级目录
function goUp() {
  const addr = getAddress(address.value);
  if (addr === 'oss://') {
    go();
    return;
  }
  const rest = addr.slice(6).replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = rest.split('/');
  parts.pop();
  const next = parts.length ? 'oss://' + parts.join('/') + '/' : 'oss://';
  address.value = next;
  go();
}

const isFav = computed(() => favoritesStore.has(address.value));

function toggleFav() {
  const addr = address.value;
  if (favoritesStore.has(addr)) {
    favoritesStore.remove(addr);
    toastStore.push(t('fav.removed') || addr, 'warning', 2000);
    return;
  }
  if (favoritesStore.add(addr)) {
    toastStore.push(t('fav.added') || addr, 'success', 2000);
  } else {
    toastStore.push(t('fav.full') || 'favorites full', 'warning', 2000);
  }
}

// 外部导航（等价 goToOssAddress 广播消费）：设置地址并触发导航
function setAddress(addr, opts) {
  address.value = getAddress(addr);
  histAdd(address.value);
  if (!opts || opts.navigate !== false) {
    navigate(address.value);
  }
}

// store 地址变化（列表内 enterFolder/goUp 触发）同步显示，不回灌导航
watch(
  () => filesStore.address,
  (next) => {
    if (next) {
      address.value = next;
    }
  }
);

onMounted(() => {
  const initial = (authStore.info && authStore.info.osspath) || 'oss://';
  address.value = initial;
});

defineExpose({ setAddress, go });
</script>

<style scoped>
.address-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e5e5;
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
  color: #555;
}
.btn-icon:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.btn-icon.active {
  color: #f5a623;
}
</style>