// P2（R-P2-01/R-P2-02）：Markdown 渲染改为显式 import showdown（devDependency，随 app.js 打包）。
// 迁移前依赖 lib.js 全局 window.showdown，lib.js 下线后该全局不存在，发行说明静默退化为纯文本。
// sanitize 白名单保持原样（等价 ngSanitize 清洗语义）——release notes 与 about_html
// 为远程/定制方内容，v-html 直插前须过滤脚本向量。

import showdown from 'showdown';

const ALLOWED_TAGS = new Set([
  'p', 'a', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'code', 'pre', 'blockquote', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
]);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'target']);

let converter = null;
let renderErrorHandler = null;

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

export function setRenderErrorHandler(handler) {
  renderErrorHandler = typeof handler === 'function' ? handler : null;
}

// 测试支持：重置惰性 Converter 单例（用于注入渲染失败）
export function resetMarkdownConverter() {
  converter = null;
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[c]));
}

function getConverter() {
  if (!converter) {
    const ConverterCtor = showdown && showdown.Converter;
    if (typeof ConverterCtor !== 'function') {
      throw new Error('showdown.Converter unavailable');
    }
    converter = new ConverterCtor({ tables: true, simplifiedAutoLink: true, strikethrough: true });
  }
  return converter;
}

export function renderMarkdown(text) {
  try {
    const raw = getConverter().makeHtml(String(text || ''));
    return sanitizeHtml(raw);
  } catch (err) {
    // 降级必须可见：返回安全转义文本并回调，由调用方展示提示（不静默）
    if (renderErrorHandler) {
      renderErrorHandler({
        code: 'MARKDOWN_RENDER_FAILED',
        message: err && err.message ? String(err.message) : 'markdown render failed',
      });
    }
    return '<pre>' + escapeHtml(text) + '</pre>';
  }
}