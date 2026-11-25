import dayjs from 'dayjs';
import { KEY_AUTHTOKEN } from './constants.js';
import * as SecureStore from './secure-store.js';

export const AUTH_TOKEN_DEBOUNCE = 600;

function base64Decode(input) {
  const binary = atob(String(input || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function decodeAuthToken(token) {
  if (!token) {
    return null;
  }
  let info;
  try {
    info = JSON.parse(base64Decode(token));
  } catch (err) {
    return null;
  }
  if (!info || typeof info !== 'object') {
    return null;
  }

  if (info.id && info.secret && info.stoken && info.privilege && info.expiration && info.osspath) {
    const time = new Date(info.expiration).getTime();
    info.isExpired = isNaN(time) ? true : time <= Date.now();
    info.expirationStr = dayjs(new Date(info.expiration)).format('YYYY-MM-DD HH:mm:ss');
    return info;
  }
  if (info.id && info.secret && String(info.id).indexOf('STS.') !== 0) {
    return info;
  }
  return null;
}

// 授权码防抖落盘（CS-02 I-7 / D-10 语义）：
// 非空经 SecureStore 加密写入；空串直写不加密不迁移；多次触发仅最后一次生效。
export function createAuthTokenWriter(write, delay = AUTH_TOKEN_DEBOUNCE) {
  let timer = null;
  let last = '';

  const persist = (token) => {
    if (token) {
      SecureStore.set(KEY_AUTHTOKEN, token);
    } else {
      localStorage.setItem(KEY_AUTHTOKEN, '');
    }
    if (typeof write === 'function') {
      write(token);
    }
  };

  return {
    schedule(token) {
      last = token || '';
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!last) {
        persist('');
        return null;
      }
      timer = setTimeout(() => {
        timer = null;
        persist(last);
      }, delay);
      return timer;
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      persist(last);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    get pending() {
      return !!timer;
    },
  };
}