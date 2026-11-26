import { snapshot } from '../bootstrap.js';

export const DEFAULT_LOCALE = 'zh-CN';

// 语言包沿用 AngularJS 的 {{name}} 插值；vue-i18n 语法为 {name}，构建期统一转换
// （保持 node/i18n/*.js 为单一来源，不复制第二份资源）。
const ANGULAR_INTERPOLATION = /\{\{\s*([\w.]+)\s*\}\}/g;

function toVueInterpolation(value) {
  return typeof value === 'string' ? value.replace(ANGULAR_INTERPOLATION, '{$1}') : value;
}

export function buildMessages(snapshotData) {
  const locales = (snapshotData && snapshotData.locales) || {};
  const messages = {};
  for (const key of Object.keys(locales)) {
    const content = locales[key].content || {};
    const converted = {};
    for (const msgKey of Object.keys(content)) {
      converted[msgKey] = toVueInterpolation(content[msgKey]);
    }
    messages[key] = converted;
  }

  const appName = snapshotData && snapshotData.appName;
  if (appName && typeof appName === 'object') {
    for (const key of Object.keys(appName)) {
      if (messages[key]) {
        messages[key]['app.name'] = appName[key] || 'OSS Browser';
      }
    }
  }

  return messages;
}

export const messages = buildMessages(snapshot);
export const availableLocales = Object.keys(messages);