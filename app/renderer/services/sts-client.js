// 等价 Angular stsSvs（app/components/services/sts.js）：assumeRole 白名单薄代理。
// 第一参 auth 注入；InvalidAccessKeyId 跳登录；返回结果结构与主进程一致（含 Credentials）。
import * as SecureStore from './secure-store.js';

function bridge() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.sts || null;
}

function currentAuth() {
  const str = SecureStore.get('auth-info', null, { legacyPlain: true });
  if (!str) {
    return {};
  }
  try {
    const info = JSON.parse(str);
    return info && typeof info === 'object' && !Array.isArray(info) ? info : {};
  } catch (err) {
    return {};
  }
}

function handleError(err) {
  if (err && err.code === 'InvalidAccessKeyId') {
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#!/login';
    }
  }
  console.error((err && err.code) + ': ' + (err && err.message));
}

export const stsClient = {
  assumeRole(roleArn, policy, seconds) {
    const api = bridge();
    if (!api || typeof api.assumeRole !== 'function') {
      return Promise.reject(new Error('sts.assumeRole is unavailable'));
    }
    return api.assumeRole(currentAuth(), roleArn, policy, seconds).then(
      (res) => {
        if (res && res.ok === false) {
          const err = new Error(res.message || res.code);
          err.code = res.code;
          err.requestId = res.requestId;
          handleError(err);
          throw err;
        }
        return res && res.ok === true ? res.data : res;
      },
      (err) => {
        handleError(err);
        throw err;
      }
    );
  },
};

export default stsClient;