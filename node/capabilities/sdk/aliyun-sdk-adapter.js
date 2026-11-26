// P7a-12（过渡态）：aliyun-sdk 的单点 require。
// 目的：为 P7b 移除第二套 OSS SDK 做准备——所有 require('aliyun-sdk') 收敛到此处，
// 后续只需替换本文件实现，无需改动业务代码。**本文件不改变任何业务行为**。
'use strict';

var sdk = require('aliyun-sdk');

module.exports = {
  sdk: sdk,
  OSS: sdk.OSS,
  STS: sdk.STS,
  RAM: sdk.RAM,
  util: sdk.util,
};