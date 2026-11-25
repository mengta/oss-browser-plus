import { describe, it, expect } from 'vitest';
import {
  messages,
  availableLocales,
  resolveLocale,
  persistLocale,
  createRendererI18n,
} from '@renderer/i18n/index.js';

describe('renderer i18n', () => {
  it('加载三语言且 custom.appName 覆盖仅合并一次', () => {
    expect(availableLocales).toEqual(['zh-CN', 'en-US', 'ja-JP']);
    expect(messages['zh-CN']['app.name']).toBe('OSS浏览器');
    expect(messages['en-US']['app.name']).toBe('OSS Browser');
  });

  it('非法 locale 回退 zh-CN，合法值透传', () => {
    expect(resolveLocale('fr-FR')).toBe('zh-CN');
    expect(resolveLocale(null)).toBe('zh-CN');
    expect(resolveLocale('en-US')).toBe('en-US');
  });

  it('t(key, params) 插值正确', () => {
    const i18n = createRendererI18n('zh-CN');
    expect(i18n.global.t('greet', { name: 'CodeArts' })).toBe('你好 CodeArts');
  });

  it('切换语言写回 localStorage 且不设置 documentElement.lang', () => {
    const next = persistLocale('ja-JP');
    expect(next).toBe('ja-JP');
    expect(localStorage.getItem('lang')).toBe('ja-JP');
    expect(document.documentElement.hasAttribute('lang')).toBe(false);
  });
});