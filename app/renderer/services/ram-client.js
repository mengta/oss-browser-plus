// 等价 Angular ramSvs（app/components/services/ram.js）：
// 18 个方法名/参数冻结（P0-11 冻结清单）；第一参 auth 注入；
// InvalidAccessKeyId 跳登录；Failed to fetch 归一为「无法连接」。
import * as SecureStore from './secure-store.js';

function bridge() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.ram || null;
}

function currentAuth() {
  // 等价 AuthInfo.get()：auth-info 密文经 SecureStore 解密（含 legacyPlain v0 迁移）
  const str = SecureStore.get('auth-info', null, { legacyPlain: true });
  if (!str) {
    return {};
  }
  try {
    const info = JSON.parse(str);
    return info && typeof info === 'object' ? info : {};
  } catch (err) {
    return {};
  }
}

function goToLogin() {
  if (typeof window === 'undefined' || !window.location) {
    return;
  }
  const ua = (window.navigator && window.navigator.userAgent) || '';
  if (ua.indexOf('jsdom') !== -1) {
    return;
  }
  window.location.hash = '#!/login';
  window.location.reload();
}

function handleError(err) {
  if (err && err.code === 'InvalidAccessKeyId') {
    goToLogin();
    return;
  }
  if (!err.code) {
    if (err.message && err.message.indexOf('Failed to fetch') !== -1) {
      err = { code: 'Error', message: '无法连接' };
    } else {
      err = { code: 'Error', message: err.message };
    }
  }
  console.error(err.code + ': ' + err.message);
}

function proxy(method) {
  return function (...args) {
    const api = bridge();
    if (!api || typeof api[method] !== 'function') {
      return Promise.reject(new Error('ram.' + method + ' is unavailable'));
    }
    const callArgs = [currentAuth()].concat(args);
    return api[method].apply(null, callArgs).then(
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
  };
}

const METHODS = [
  'listUsers',
  'listGroups',
  'listRoles',
  'createPolicy',
  'getPolicy',
  'attachPolicyToRole',
  'attachPolicyToGroup',
  'attachPolicyToUser',
  'detachPolicyFromUser',
  'listPoliciesForUser',
  'getUser',
  'createUser',
  'updateUser',
  'deleteUser',
  'createAccessKey',
  'updateAccessKey',
  'deleteAccessKey',
  'listAccessKeys',
];

const ramClient = {};
for (const method of METHODS) {
  ramClient[method] = proxy(method);
}

export default ramClient;
export const ram = ramClient;