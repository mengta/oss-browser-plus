import { defineStore } from 'pinia';
import { readStoredLocale, persistLocale, availableLocales } from '../i18n/index.js';

export const useLangStore = defineStore('lang', {
  state: () => ({
    locale: readStoredLocale(),
    available: availableLocales,
  }),
  actions: {
    setLocale(locale) {
      this.locale = persistLocale(locale);
      return this.locale;
    },
  },
});