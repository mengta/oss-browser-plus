import { describe, it, expect } from 'vitest';
import { computed, ref } from 'vue';
import { useVirtualRows } from '@renderer/composables/useVirtualRows.js';

// V-07（P5/R-P5-01）：固定行高窗口化纯函数。
function nextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

describe('useVirtualRows', () => {
  it('viewportHeight=0 时渲染首屏窗口（0..30）', () => {
    const v = useVirtualRows({
      total: computed(() => 1000),
      rowHeight: 32,
      viewportHeight: ref(0),
    });
    expect(v.start.value).toBe(0);
    expect(v.end.value).toBe(30);
    expect(v.topPad.value).toBe(0);
  });

  it('滚动后窗口偏移正确且 spacer 守恒', async () => {
    const v = useVirtualRows({
      total: computed(() => 1000),
      rowHeight: 32,
      viewportHeight: ref(600),
    });
    v.onScroll({ target: { scrollTop: 3200 } });
    await nextFrame();

    expect(v.start.value).toBeGreaterThan(0);
    const rendered = v.end.value - v.start.value;
    const totalHeight = v.topPad.value + rendered * 32 + v.bottomPad.value;
    expect(totalHeight).toBe(1000 * 32);
    expect(rendered).toBeLessThan(1000);
  });

  it('接近底部时 bottomPad 归零且 end 不超过 total', async () => {
    const v = useVirtualRows({
      total: computed(() => 50),
      rowHeight: 32,
      viewportHeight: ref(600),
    });
    v.onScroll({ target: { scrollTop: 1600 } });
    await nextFrame();
    expect(v.end.value).toBe(50);
    expect(v.bottomPad.value).toBe(0);
  });

  it('窗口内渲染行数 ≈ 可视行数 + overscan（≤ 可视+20）', () => {
    const v = useVirtualRows({
      total: computed(() => 1000),
      rowHeight: 32,
      viewportHeight: ref(600),
    });
    const rendered = v.end.value - v.start.value;
    const visible = Math.ceil(600 / 32);
    expect(rendered).toBeLessThanOrEqual(visible + 20);
  });
});