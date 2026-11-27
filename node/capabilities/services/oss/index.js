'use strict';

// P6c（T-P6c-01）：OSS 能力聚合入口；方法名与 main.js 通道一致。
const context = require('./context');
const client = require('./client');
const list = require('./list');
const object = require('./object');
const acl = require('./acl');
const del = require('./delete');
const copy = require('./copy');
const multipart = require('./multipart');

const modules = { client, list, object, acl, delete: del, copy, multipart };
for (const mod of Object.values(modules)) Object.assign(context.hub, mod);

module.exports = {
  createFolder: object.createFolder,
  createBucket: object.createBucket,
  restoreFile: object.restoreFile,
  loadStorageStatus: list.loadStorageStatus,
  getMeta: object.getMeta2,
  getFileInfo: object.getMeta2,
  setMeta: object.setMeta,
  setMeta2: object.setMeta2,
  checkFileExists: client.checkFileExists,
  checkFolderExists: client.checkFolderExists,
  listAllBuckets: list.listAllBuckets,
  listAllFiles: list.listAllFiles,
  listFiles: list.listFiles,
  getContent: object.getContent,
  saveContent: object.saveContent,
  getImageBase64Url: object.getImageBase64Url,
  loadObjectSymlinkMeta: object.loadObjectSymlinkMeta,
  putObjectSymlinkMeta: object.putObjectSymlinkMeta,
  moveFile: copy.moveFile,
  copyFiles: copy.copyFiles,
  stopCopyFiles: copy.stopCopyFiles,
  deleteFiles: del.deleteFiles,
  deleteMultiFiles: del.deleteMultiFiles,
  deleteFolder: del.deleteFolder,
  stopDeleteFiles: del.stopDeleteFiles,
  listAllUploads: multipart.listAllUploads,
  abortAllUploads: multipart.abortAllUploads,
  deleteBucket: object.deleteBucket,
  listAllCustomDomains: list.listAllCustomDomains,
  listUsableAccelarateDomains: list.listUsableAccelarateDomains,
  getBucketACL: acl.getBucketACL,
  updateBucketACL: acl.updateBucketACL,
  getACL: acl.getACL,
  updateACL: acl.updateACL,
  getClient: client.getClient,
  parseOSSPath: client.parseOSSPath,
  getOssEndpoint: client.getOssEndpoint,
  parseRestoreInfo: list.parseRestoreInfo,
  signatureUrl: client.signatureUrl,
  getClient2: client.getClient2,
  getClient3: client.getClient3,
  signatureUrl2: client.signatureUrl2,
};
