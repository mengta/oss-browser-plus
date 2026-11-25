import { describe, it, expect, beforeAll } from 'vitest';
import { sanitizeHtml } from '@renderer/services/markdown.js';

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