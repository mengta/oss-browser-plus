// P5（R-P5-01）：查找最近可滚动祖先（从 BottomLoader.vue 提取共用）。
export function findScrollParent(el) {
  let node = el && el.parentElement;
  while (node) {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
    const overflow = style ? style.overflowY : '';
    if (overflow === 'auto' || overflow === 'scroll') {
      return node;
    }
    node = node.parentElement;
  }
  return el ? el.parentElement : null;
}