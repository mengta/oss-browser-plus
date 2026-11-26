<template>
  <div class="flv-player" data-testid="flv-player">
    <div v-if="error" class="flv-error" data-testid="flv-error">{{ t('cannot.preview') }}</div>
    <iframe
      v-else-if="url"
      :src="url"
      class="flv-frame"
      data-testid="flv-iframe"
      scrolling="no"
    />
    <div v-else class="flv-loading" data-testid="flv-loading">{{ t('loading') }}</div>
  </div>
</template>

<script setup>
// 等价 flv-player 指令（app/components/directives/flv-player.js）：
// iframe 指向 http://localhost:{staticServerPort}/flv-player.html?src=<encodeURIComponent>&autoplay=
// （static 服务根目录 = 仓库 static/，见 server.js；不重写播放器，复用 static/flv-player.html）。
// 端口未就绪（getStaticServerPort 失败/非法）时给等价失败表现：不渲染可用 iframe，展示不可预览提示。
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../../services/api.js';

const props = defineProps({
  src: { type: String, default: '' },
  autoplay: { type: Boolean, default: false },
});

const { t } = useI18n();
const url = ref('');
const error = ref(false);

async function build() {
  if (!props.src) {
    url.value = '';
    error.value = false;
    return;
  }
  try {
    const res = await api.system.getStaticServerPort();
    const port = res && res.ok ? res.data : NaN;
    if (!Number.isFinite(port)) {
      throw new Error('static server port is not ready');
    }
    url.value =
      'http://localhost:' +
      port +
      '/flv-player.html?src=' +
      encodeURIComponent(props.src) +
      '&autoplay=' +
      (props.autoplay ? 'autoplay' : '');
    error.value = false;
  } catch (err) {
    url.value = '';
    error.value = true;
  }
}

onMounted(build);
watch(() => props.src, build);
</script>

<style scoped>
.flv-player {
  width: 100%;
  min-height: 360px;
}
.flv-frame {
  border: 0;
  width: 100%;
  height: 460px;
}
.flv-loading,
.flv-error {
  padding: 20px;
  text-align: center;
}
.flv-error {
  background: var(--vsc-warning-bg);
  color: var(--vsc-warning);
}
.flv-loading {
  color: var(--vsc-fg-muted);
}
</style>