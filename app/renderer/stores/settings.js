import { defineStore } from 'pinia';
import * as SecureStore from '../services/secure-store.js';

// 等价 Angular settingsSvs：键名/默认值/取值类型零变更（VR-04-01 / VR-07-05/06）。
// localStorage 直读键与原版一致；mailSender 走 SecureStore（CS-02 I-6 惰性迁移）。

const INT_KEYS = {
  autoUpgrade: 1,
  isCame: 0,
  maxUploadJobCount: 3,
  maxDownloadJobCount: 1,
  showImageSnapshot: 1,
  historiesLength: 100,
  logFile: 0,
  logFileInfo: 0,
  connectTimeout: 60000,
  uploadPartSize: 10,
  downloadConcurrecyPartSize: 5,
  listObjectNum: 500,
  uploadAndDownloadRetryTimes: 5,
};

const STRING_KEYS = {
  getRequestPayStatus: 'NO',
};

const MAIL_DEFAULT = { port: 465 };

function readInt(key) {
  return parseInt(localStorage.getItem(key) || INT_KEYS[key]);
}

function readMailSmtp() {
  // CS-02（I-6）：legacyPlain 开启，v0 明文命中即惰性迁移；
  // 损坏值回退默认对象（D-11，修正存量抛异常缺陷，原值保留）
  const str = SecureStore.get('mailSender', null, { legacyPlain: true });
  if (str === null) {
    return MAIL_DEFAULT;
  }
  try {
    return JSON.parse(str);
  } catch (err) {
    return MAIL_DEFAULT;
  }
}

let saveTimer = null;

export const useSettingsStore = defineStore('settings', {
  state: () => {
    const initial = {};
    for (const key of Object.keys(INT_KEYS)) {
      initial[key] = readInt(key);
    }
    for (const key of Object.keys(STRING_KEYS)) {
      initial[key] = localStorage.getItem(key) || STRING_KEYS[key];
    }
    initial.mailSmtp = readMailSmtp();
    return initial;
  },
  actions: {
    set(key, value) {
      if (key === 'mailSmtp') {
        SecureStore.set('mailSender', JSON.stringify(value));
        this.mailSmtp = value;
        return;
      }
      if (key in STRING_KEYS) {
        localStorage.setItem(key, value);
        this[key] = value;
        return;
      }
      localStorage.setItem(key, value);
      this[key] = typeof value === 'number' ? value : parseInt(value);
    },
    // 设置保存 500ms 防抖（多次连续修改仅最后一次生效）
    debouncedSet(key, value, delay = 500) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      saveTimer = setTimeout(() => {
        saveTimer = null;
        this.set(key, value);
      }, delay);
    },
    resetMailSmtp() {
      this.mailSmtp = MAIL_DEFAULT;
    },
  },
});