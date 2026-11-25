// B2-14（Q-07/D-14）：Markdown 渲染保留 showdown（与迁移前同源，lib.js 全局）；
// sanitize 白名单补齐迁移前 ngSanitize 的清洗语义——release notes 与 about_html
// 为远程/定制方内容，v-html 直插前须过滤脚本向量。

const ALLOWED_TAGS = new Set([
  'p', 'a', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'code', 'pre', 'blockquote', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
]);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'target']);

function isSafeUrl(value) {
  const v = String(value || '').trim();
  if (v === '' || v === '#') {
    return true;
  }
  return (
    /^(https?:|\/|#|mailto:)/i.test(v) ||
    /^data:image\//i.test(v) ||
    !/^[a-z][a-z0-9+.-]*:/i.test(v)
  );
}

function sanitizeNode(node) {
  if (node.nodeType === 3) {
    return;
  }
  if (node.nodeType !== 1) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
    return;
  }
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      return;
    }
    // 未知标签：保留子内容（等价 ngSanitize 剥壳语义）
    const parent = node.parentNode;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
    return;
  }
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) {
      node.removeAttribute(attr.name);
      continue;
    }
    if (name === 'href' || name === 'src') {
      if (!isSafeUrl(attr.value)) {
        node.removeAttribute(attr.name);
      }
    }
  }
  for (const child of Array.from(node.childNodes)) {
    sanitizeNode(child);
  }
}

export function sanitizeHtml(html) {
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  for (const child of Array.from(doc.body.childNodes)) {
    sanitizeNode(child);
  }
  return doc.body.innerHTML;
}

export function renderMarkdown(text) {
  const Converter = typeof window !== 'undefined' && window.showdown && window.showdown.Converter;
  const raw = Converter
    ? new Converter().makeHtml(String(text || ''))
    : String(text || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return sanitizeHtml(raw);
}