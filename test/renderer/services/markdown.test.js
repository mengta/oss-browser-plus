import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import showdown from 'showdown';
import { sanitizeHtml, renderMarkdown, setRenderErrorHandler, resetMarkdownConverter } from '@renderer/services/markdown.js';

// B2-14（Q-07）：showdown 保留 + 显式 sanitize 白名单（等价迁移前 ngSanitize 语义）
describe('sanitizeHtml 白名单', () => {
  beforeAll(() => {
    if (!window.showdown) {
      window.showdown = { Converter: class { makeHtml(t) { return '<p>' + t + '</p>'; } } };
    }
  });

  it('保留白名单标签与安全属性', () => {
    const html = '<p><a href="https://a.b/c" title="x">link</a> <b>bold</b><ul><li>i</li></ul></p>';
    expect(sanitizeHtml(html)).toContain('<a href="https://a.b/c" title="x">link</a>');
    expect(sanitizeHtml(html)).toContain('<b>bold</b>');
    expect(sanitizeHtml(html)).toContain('<li>i</li>');
  });

  it('移除 script/iframe/style 全量与事件属性', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).not.toContain('script');
    expect(sanitizeHtml('<p>ok</p><iframe src="https://e.v"></iframe>')).not.toContain('iframe');
    expect(sanitizeHtml('<a href="https://a.b" onclick="alert(1)">x</a>')).not.toContain('onclick');
    expect(sanitizeHtml('<a href="https://a.b" onmouseover="x()">x</a>')).not.toContain('onmouseover');
  });

  it('拦截 javascript: 伪协议 URL', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    // eslint-disable-next-line no-script-url -- 用例数据：断言伪协议已被拦截
    expect(out).not.toContain('javascript:');
    const img = sanitizeHtml('<img src="javascript:alert(1)" alt="p">');
    // eslint-disable-next-line no-script-url -- 用例数据：断言伪协议已被拦截
    expect(img).not.toContain('javascript:');
    expect(img).toContain('alt="p"');
  });

  it('未知标签剥壳保留子内容（等价 ngSanitize）', () => {
    const out = sanitizeHtml('<article><p>keep</p></article>');
    expect(out).toContain('<p>keep</p>');
    expect(out).not.toContain('<article');
  });

  it('白名单内 img src 保留 https/data:image', () => {
    expect(sanitizeHtml('<img src="https://a.b/i.png" alt="a">')).toContain('src="https://a.b/i.png"');
    expect(sanitizeHtml('<img src="data:image/png;base64,AAA" alt="b">')).toContain('src="data:image/png;base64,AAA"');
  });
});
// P2（R-P2-01/R-P2-02 · V-01/V-02）：显式 import showdown 后的渲染回归 + 降级可见
describe('renderMarkdown（showdown 显式渲染）', () => {
  afterEach(() => {
    setRenderErrorHandler(null);
    vi.restoreAllMocks();
  });

  it('渲染标题/段落/列表/链接/代码块/表格为对应 HTML 标签', () => {
    const md = [
      '# 标题一',
      '## 标题二',
      '',
      '段落文本',
      '',
      '- 项一',
      '- 项二',
      '',
      '[链接](https://example.com)',
      '',
      '```js',
      'const a = 1;',
      '```',
      '',
      '| 列A | 列B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n');
    const html = renderMarkdown(md);
    expect(html).toContain('<h1');
    expect(html).toContain('<h2');
    expect(html).toContain('<p>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<code');
    expect(html).toContain('<table>');
    expect(html).toContain('<th');
  });

  it('剥离 script/onerror/javascript: 等注入向量', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n[x](javascript:alert(3))');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    // eslint-disable-next-line no-script-url -- 用例数据：断言伪协议已被拦截
    expect(html).not.toContain('javascript:');
  });

  it('渲染失败时返回安全转义文本并回调 MARKDOWN_RENDER_FAILED（不静默）', () => {
    const events = [];
    setRenderErrorHandler((info) => events.push(info));
    const Original = showdown.Converter;
    showdown.Converter = class {
      makeHtml() {
        throw new Error('boom');
      }
    };
    resetMarkdownConverter();
    try {
      const html = renderMarkdown('# 标题 <b>x</b>');
      expect(events.length).toBe(1);
      expect(events[0].code).toBe('MARKDOWN_RENDER_FAILED');
      expect(html).toContain('<pre>');
      expect(html).not.toContain('<b>x</b>');
      expect(html).toContain('&lt;b&gt;');
    } finally {
      showdown.Converter = Original;
      resetMarkdownConverter();
    }
  });
});