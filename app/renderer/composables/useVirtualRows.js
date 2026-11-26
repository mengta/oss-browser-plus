// P5（R-P5-01）：固定行高窗口化（不做动态测量）。
// 约束：topPad + rows*H + bottomPad ≡ total*H；viewportHeight=0 时渲染首屏窗口（0..30）。
import { computed, ref } from 'vue';

export function useVirtualRows(options) {
  const opts = options || {};
  const rowHeight = Number(opts.rowHeight || 32);
  const overscanTop = Number(opts.overscanTop === undefined ? 10 : opts.overscanTop);
  const overscanBottom = Number(opts.overscanBottom === undefined ? 10 : opts.overscanBottom);
  const initialWindow = Number(opts.initialWindow || 30);

  const totalRef =
    opts.total && typeof opts.total === 'object' && 'value' in opts.total
      ? opts.total
      : ref(Number(opts.total || 0));
  const viewportRef =
    opts.viewportHeight && typeof opts.viewportHeight === 'object' && 'value' in opts.viewportHeight
      ? opts.viewportHeight
      : ref(Number(opts.viewportHeight || 0));

  const scrollTop = ref(0);
  let raf = 0;

  const total = computed(() => Math.max(0, Number(totalRef.value) || 0));
  const viewportHeight = computed(() => Math.max(0, Number(viewportRef.value) || 0));

  const start = computed(() => {
    if (!viewportHeight.value) return 0;
    return Math.max(0, Math.floor(scrollTop.value / rowHeight) - overscanTop);
  });

  const visibleCount = computed(() => {
    if (!viewportHeight.value) return Math.min(total.value, initialWindow);
    return Math.ceil(viewportHeight.value / rowHeight) + overscanTop + overscanBottom;
  });

  const end = computed(() => Math.min(total.value, start.value + visibleCount.value));
  const topPad = computed(() => start.value * rowHeight);
  const bottomPad = computed(() => Math.max(0, (total.value - end.value) * rowHeight));

  function onScroll(event) {
    const next = event && event.target ? Number(event.target.scrollTop) || 0 : 0;
    if (raf) return;
    const rafFn = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
    if (!rafFn) {
      scrollTop.value = next;
      return;
    }
    raf = rafFn(() => {
      raf = 0;
      scrollTop.value = next;
    });
  }

  function onResize(height) {
    if (height === undefined) return;
    viewportRef.value = Number(height) || 0;
  }

  function dispose() {
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
  }

  return { rowHeight, start, end, topPad, bottomPad, onScroll, onResize, dispose };
}