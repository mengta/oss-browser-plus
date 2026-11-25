import { snapshot } from '../bootstrap.js';

export const DEFAULT_LOCALE = 'zh-CN';

export function buildMessages(snapshotData) {
  const locales = (snapshotData && snapshotData.locales) || {};
  const messages = {};
  for (const key of Object.keys(locales)) {
    messages[key] = Object.assign({}, locales[key].content);
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