import { createI18n } from 'vue-i18n';
import { messages, availableLocales, DEFAULT_LOCALE } from './locales.js';

const STORAGE_KEY = 'lang';

export function resolveLocale(raw) {
  if (raw && availableLocales.indexOf(raw) >= 0) {
    return raw;
  }
  if (availableLocales.indexOf(DEFAULT_LOCALE) >= 0) {
    return DEFAULT_LOCALE;
  }
  return availableLocales[0] || DEFAULT_LOCALE;
}

export function readStoredLocale() {
  try {
    return resolveLocale(localStorage.getItem(STORAGE_KEY));
  } catch (err) {
    return resolveLocale(null);
  }
}

export function persistLocale(locale) {
  const next = resolveLocale(locale);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (err) {
    // 存储不可用时仅内存生效
  }
  return next;
}

export function createRendererI18n(locale) {
  return createI18n({
    legacy: false,
    locale: resolveLocale(locale),
    fallbackLocale: 'en-US',
    messages,
  });
}

export { messages, availableLocales, DEFAULT_LOCALE };