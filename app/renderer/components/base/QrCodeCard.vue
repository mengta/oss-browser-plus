<template>
  <div class="qr-code-card" data-testid="qrcode-card">
    <svg
      v-if="path"
      :viewBox="'0 0 ' + count + ' ' + count"
      :width="width"
      :height="height"
      shape-rendering="crispEdges"
      class="qr-svg"
      data-testid="qrcode-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect :width="count" :height="count" fill="#ffffff" />
      <path :d="path" fill="#000000" />
    </svg>
    <div class="qr-label"><slot /></div>
  </div>
</template>

<script setup>
// 等价 qrcode 指令（app/components/directives/qrcode.js）：
// 内容 = text；尺寸 = width/height（缺省 100）；纠错级别 H（与 jquery.qrcode 默认一致）。
// 生成矩阵使用 qrcode-generator（MIT，Kazuhiko Arase，替换 jquery.qrcode 的矩阵实现），
// SVG 渲染自研（D-12/D-15：去 jQuery 依赖，可按需导出 data URL 供邮件内嵌）。
import { onBeforeUnmount, ref, watch } from 'vue';
import qrcode from 'qrcode-generator';
import { base64Encode } from '../../services/base64.js';

const props = defineProps({
  text: { type: String, default: '' },
  width: { type: Number, default: 100 },
  height: { type: Number, default: 100 },
});

const path = ref('');
const count = ref(0);

function build() {
  const text = props.text || '';
  if (!text) {
    path.value = '';
    count.value = 0;
    return;
  }
  const qr = qrcode(0, 'H');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col)) {
        d += 'M' + col + ',' + row + 'h1v1h-1z';
      }
    }
  }
  count.value = size;
  path.value = d;
}

watch(() => props.text, build, { immediate: true });

onBeforeUnmount(() => {
  path.value = '';
});

// 供邮件分享内嵌（原版 canvas.toDataURL('image/jpeg') 的等价输出，SVG data URL）
function toDataURL() {
  if (!path.value) return '';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    count.value +
    ' ' +
    count.value +
    '" width="' +
    props.width +
    '" height="' +
    props.height +
    '" shape-rendering="crispEdges">' +
    '<rect width="' +
    count.value +
    '" height="' +
    count.value +
    '" fill="#ffffff"/>' +
    '<path fill="#000000" d="' +
    path.value +
    '"/></svg>';
  return 'data:image/svg+xml;base64,' + base64Encode(svg);
}

defineExpose({ toDataURL });
</script>

<style scoped>
.qr-code-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.qr-svg {
  display: block;
}
.qr-label {
  font-size: 12px;
  color: var(--vsc-fg-muted);
}
</style>