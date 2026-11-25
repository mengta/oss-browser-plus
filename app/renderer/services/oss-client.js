// 等价 Angular ossSvs2 的渲染层薄客户端（B2-09 提前落 ACL/元数据 4 方法；
// B3-01 扩展为完整 OSS 客户端门面）。方法名/参数语义与 node/capabilities/services/oss2.js 冻结清单一致。
import * as SecureStore from './secure-store.js';

function bridge() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  return window.ossBrowser.oss || null;
}

function currentAuth() {
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

function proxy(method) {
  return function (...args) {
    const api = bridge();
    if (!api || typeof api[method] !== 'function') {
      return Promise.reject(new Error('oss.' + method + ' is unavailable'));
    }
    const callArgs = [currentAuth()].concat(args);
    return api[method].apply(null, callArgs).then(
      (res) => {
        if (res && res.ok === false) {
          const err = new Error(res.message || res.code);
          err.code = res.code;
          err.requestId = res.requestId;
          if (res.ecCode) err.ecCode = res.ecCode;
          throw err;
        }
        return res && res.ok === true ? res.data : res;
      },
      (err) => {
        if (err && err.code === 'InvalidAccessKeyId') {
          if (typeof window !== 'undefined' && window.location) {
            window.location.hash = '#!/login';
          }
        }
        throw err;
      }
    );
  };
}

export const ossClient = {
  getACL: proxy('getACL'),
  updateACL: proxy('updateACL'),
  getMeta: proxy('getMeta'),
  setMeta2: proxy('setMeta2'),
  // B3-01：bucket/对象列表（签名与 node/capabilities/services/oss2.js 冻结清单一致）
  listAllBuckets: proxy('listAllBuckets'),
  listFiles: function (region, bucket, key, marker) {
    return proxy('listFiles')(region, bucket, key, marker || '');
  },
  // B3-03：bucket 删除（B3-04 弹窗补齐 createBucket/getBucketACL/updateBucketACL）
  deleteBucket: proxy('deleteBucket'),
};

export default ossClient;