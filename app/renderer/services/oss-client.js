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
          if (res.failures) err.failures = res.failures;
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
  listAllFiles: proxy('listAllFiles'),
  listFiles: function (region, bucket, key, marker) {
    return proxy('listFiles')(region, bucket, key, marker || '');
  },
  // B3-03：bucket 删除（B3-04 弹窗补齐 createBucket/getBucketACL/updateBucketACL）
  deleteBucket: proxy('deleteBucket'),
  // B3-04：Bucket 管理弹窗
  createBucket: proxy('createBucket'),
  getBucketACL: proxy('getBucketACL'),
  updateBucketACL: proxy('updateBucketACL'),
  listAllUploads: proxy('listAllUploads'),
  abortAllUploads: proxy('abortAllUploads'),
  // B3-06：上传链路（目录条目建目录）
  createFolder: proxy('createFolder'),
  // B3-09：重命名/复制/移动/删除（签名与 node/capabilities/services/oss2.js 冻结清单一致）
  checkFileExists: proxy('checkFileExists'),
  checkFolderExists: proxy('checkFolderExists'),
  moveFile: proxy('moveFile'),
  // 进度回调经 preload 转 oss:progress（第 4 参为 function，不跨 IPC）
  copyFiles: proxy('copyFiles'),
  stopCopyFiles: proxy('stopCopyFiles'),
  deleteFiles: proxy('deleteFiles'),
  stopDeleteFiles: proxy('stopDeleteFiles'),
  // B3-10：恢复/软链/CRC/地址（HEAD 信息、解冻、符号链接元数据、端点与签名链接）
  getFileInfo: proxy('getFileInfo'),
  restoreFile: proxy('restoreFile'),
  putObjectSymlinkMeta: proxy('putObjectSymlinkMeta'),
  getOssEndpoint: proxy('getOssEndpoint'),
  signatureUrl2: proxy('signatureUrl2'),
  signatureUrl: proxy('signatureUrl'),
  listAllCustomDomains: proxy('listAllCustomDomains'),
  listUsableAccelarateDomains: proxy('listUsableAccelarateDomains'),
  // B3-11：预览（文本内容/图片二进制）
  getContent: proxy('getContent'),
  getImageBase64Url: proxy('getImageBase64Url'),
  // B3-12：代码预览保存
  saveContent: proxy('saveContent'),
};

export default ossClient;