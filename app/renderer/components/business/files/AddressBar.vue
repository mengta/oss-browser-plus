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
    <button type="button" class="btn-icon" data-testid="address-go-up" title="Up" @click="goUp">
      <AppIcon name="arrow-up" />
    </button>
    <button type="button" class="btn-icon" data-testid="address-refresh" title="Refresh" @click="refresh">
      <AppIcon name="refresh" />
    </button>
    <button type="button" class="btn-icon" data-testid="address-home" title="Home" @click="goHome">
      <AppIcon name="home" />
    </button>

    <form class="address-form" @submit.prevent="go">
      <!-- B5-UI：VS Code 面包屑（点击层级导航；点击空白/聚焦切换为可编辑路径） -->
      <div
        class="crumbs"
        :class="{ editing: focused }"
        data-testid="address-crumbs"
        @click="startEdit"
      >
        <span class="crumb crumb-root" data-testid="crumb-root" @click.stop="navigateLevel(-1)">oss://</span>
        <template v-if="bucket">
          <span class="sep">/</span>
          <span class="crumb crumb-bucket" data-testid="crumb-bucket" :title="bucket" @click.stop="navigateLevel(0)">{{ bucket }}</span>
          <span class="sep">/</span>
        </template>
        <template v-for="(seg, idx) in segments" :key="idx">
          <span class="crumb" :data-testid="'crumb-' + idx" @click.stop="navigateLevel(idx + 1)">{{ seg }}</span>
          <span class="sep">/</span>
        </template>
      </div>
      <input
        ref="inputEl"
        v-model="address"
        type="text"
        class="form-control address-input"
        :class="{ editing: focused }"
        data-testid="address-input"
        placeholder="oss://"
        spellcheck="false"
        @focus="focused = true"
        @blur="focused = false"
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
      <AppIcon :name="isFav ? 'star-filled' : 'star'" />
    </button>
  </div>
</template>

<script setup>
// 等价 Angular address-bar（app/main/files/_/address-bar.js）：
// oss:// 地址输入（getAddress 修正）、自维护历史栈（去重/截断前进/上限 historiesLength）、
// goUp 多级回退（根时刷新）、收藏星标；地址变更直接驱动 filesStore.navigate。
// B5-UI：新增 VS Code 面包屑（层级可点导航），保留 address-input 供键盘/E2E 编辑。
import { ref, computed, watch, onMounted, nextTick } from 'vue';
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
const focused = ref(false);
const inputEl = ref(null);

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

// ---------- B5-UI 面包屑 ----------
const restPath = computed(() => String(address.value || '').replace(/^oss:\/\//, '').replace(/^\/+/, ''));
const bucket = computed(() => {
  const value = restPath.value.replace(/\/$/, '');
  if (!value) return '';
  return value.split('/')[0];
});
const segments = computed(() => {
  const value = restPath.value.replace(/\/$/, '');
  if (!value) return [];
  const parts = value.split('/');
  return parts.length > 1 ? parts.slice(1) : [];
});

function navigateLevel(level) {
  if (level < 0) {
    address.value = 'oss://';
  } else if (level === 0) {
    address.value = bucket.value ? 'oss://' + bucket.value + '/' : 'oss://';
  } else {
    const parts = segments.value.slice(0, level);
    address.value = bucket.value ? 'oss://' + bucket.value + '/' + parts.join('/') + '/' : 'oss://';
  }
  go();
}

function startEdit() {
  focused.value = true;
  nextTick(() => {
    if (inputEl.value) {
      inputEl.value.focus();
      inputEl.value.select();
    }
  });
}

// 默认地址：预设 ossPath 优先，其次已保存地址，最后根
const defaultAddress = computed(() => {
  const info = authStore.info || {};
  return info.osspath || info.address || 'oss://';
});

function refresh() {
  go();
}

// 等价原版 goHome：与默认地址不同则跳转，相同则刷新
function goHome() {
  const target = defaultAddress.value;
  if (address.value !== target) {
    address.value = target;
    go();
    return;
  }
  go();
}


const isFav = computed(() => favoritesStore.has(address.value));

function toggleFav() {
  const addr = address.value;
  if (favoritesStore.has(addr)) {
    favoritesStore.remove(addr);
    toastStore.push(t('bookmarks.delete.success'), 'warning', 2000);
    return;
  }
  if (favoritesStore.add(addr)) {
    toastStore.push(t('bookmarks.add.success'), 'success', 2000);
  } else {
    toastStore.push(t('bookmarks.full'), 'warning', 2000);
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
  favoritesStore.warm();
  const info = authStore.info || {};
  const initial = info.osspath || info.address || 'oss://';
  address.value = initial;
});

defineExpose({ setAddress, go });
</script>

<style scoped>
.address-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--vsc-surface-2);
  border-bottom: 1px solid var(--vsc-border);
}
.address-form {
  flex: 1;
  min-width: 0;
  position: relative;
  height: 26px;
}
.crumbs {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  background: var(--vsc-bg-input);
  border: 1px solid var(--vsc-border);
  border-radius: 2px;
  cursor: text;
}
.crumbs.editing {
  opacity: 0;
}
.crumb {
  padding: 1px 4px;
  border-radius: 2px;
  color: var(--vsc-fg-muted);
  cursor: pointer;
}
.crumb:hover {
  background: var(--vsc-bg-hover);
  color: var(--vsc-fg);
}
.crumb-root {
  color: var(--vsc-fg-dim);
}
.crumb-bucket {
  color: var(--vsc-fg);
  font-weight: 600;
}
.sep {
  color: var(--vsc-fg-dim);
}
.address-input {
  position: absolute;
  inset: 0;
  width: 100%;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  background: var(--vsc-bg-input);
}
.address-input.editing {
  opacity: 1;
  pointer-events: auto;
}
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: none;
  padding: 0;
  cursor: pointer;
  line-height: 1;
  color: var(--vsc-fg-muted);
}
.btn-icon:hover:not(:disabled) {
  background: var(--vsc-bg-hover);
  color: var(--vsc-fg);
}
.btn-icon:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.btn-icon.active {
  color: var(--vsc-highlight);
}
.btn-icon.active :deep(svg) {
  transform: scale(1.1);
}
</style>