'use strict';

// i18n 基线单测（源 app/components/services/i18n.js）
// navigator 替身注入 locale 保证确定性。
// 存量瑕疵现状锁定：translate 的 options 插值无效（返回原文案，未替换 {{k}} 占位），
// 属存量行为，非本次修复范围（design 1.2.4-1），升级后必须保持现状一致。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubNavigator } from '../../../helpers/env-stubs.js';

function loadI18n(locale) {
  const restore = stubNavigator(locale);
  const reg = stubAngular();
  reg.load('app/components/services/i18n.js');
  restore();
  return reg.get('I18n');
}

test('初始 locale 取自 navigator.language', (t) => {
  const I18n = loadI18n('zh-CN');
  t.is(I18n.getLocale(), 'zh-CN');
});

test('use 切换当前 locale', (t) => {
  const I18n = loadI18n('en-US');
  I18n.use('zh-CN');
  t.is(I18n.getLocale(), 'zh-CN');
});

test('translate 按 locale 返回文案', (t) => {
  const I18n = loadI18n('zh-CN');
  I18n.init('zh-CN', { 'app.title': 'OSS 浏览器' });
  I18n.init('en-US', { 'app.title': 'OSS Browser' });

  t.is(I18n.translate('app.title'), 'OSS 浏览器');
  t.is(I18n.translate('app.title', undefined, 'en-US'), 'OSS Browser');
  I18n.use('en-US');
  t.is(I18n.translate('app.title'), 'OSS Browser');
});

test('translate 已 init 的 locale 下未命中 key 返回 undefined（存量行为）', (t) => {
  const I18n = loadI18n('zh-CN');
  I18n.init('zh-CN', { 'known.key': 'v' });

  t.is(I18n.translate('missing.key'), undefined);
  t.is(I18n.translate('known.key'), 'v');
});

test('translate 未 init 的 locale 触发 catch 返回 key 原文', (t) => {
  const I18n = loadI18n('fr-FR');

  t.is(I18n.translate('missing.key'), 'missing.key');
});

test('translate2 filter 透传 I18n.translate（含 options 路径）', (t) => {
  const restore = stubNavigator('zh-CN');
  const reg = stubAngular();
  reg.load('app/components/services/i18n.js');
  restore();
  const I18n = reg.get('I18n');
  I18n.init('zh-CN', { 'greet.hello': '你好 {{name}}' });
  const translate2 = reg.getFilter('translate2');

  t.is(translate2('greet.hello'), '你好 {{name}}');
});

test('存量瑕疵锁定：translate 的 options 插值不生效，返回原文案（含占位符）', (t) => {
  // 存量瑕疵，非本次修复范围（design 1.2.4-1）：msg.replace 未接收返回值，占位符保留原样
  const I18n = loadI18n('zh-CN');
  I18n.init('zh-CN', { 'auth.removeAK.message': '确认删除 {{ id }}？' });

  const out = I18n.translate('auth.removeAK.message', { id: 'LTAI123' });

  t.is(out, '确认删除 {{ id }}？');
});