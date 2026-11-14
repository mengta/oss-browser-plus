'use strict';

// oss-download-manager createJob endpoint 契约单测（源 app/components/services/oss-download-manager.js）
// 锚点：createJob 的 STS 与非 STS 两分支，OssStore 的 endpoint 均取
// ossSvs2.getOssEndpoint(opt.region, opt.from.bucket, eptpl) —— 下载源 bucket。
// 背景：download 版 createJob 复制自 upload 版（upload 的 opt.to={bucket,key} 含 bucket），
// STS 分支曾残留 opt.to.bucket；而下载任务的 opt.to={name,path}（见源文件 @param 注释）
// 无 bucket 字段，该值恒为 undefined，导致 getOssEndpoint 跳过 bucketMap
// 专属 endpoint 解析、直落 region 模板兜底。
// OssStore 以 require-cache 替身注入（进程边界隔离，无真实 OSS 交互）；
// './node/ossstore' 相对路径经 Module._resolveFilename 重定向至仓库根
// node/ossstore/lib/index.js（与 dist 运行时布局等价语义）。

import test from 'ava';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module from 'node:module';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubModuleByPath, unstubAll } from '../../../helpers/module-stubs.js';

const OSSSTORE_PATH = path.resolve('node/ossstore/lib/index.js');
const SOURCE_SUFFIX = path.join('oss-download-manager.js');

function patchOssstoreResolve() {
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    if (
      request === './node/ossstore' &&
      parent &&
      parent.filename &&
      parent.filename.endsWith(SOURCE_SUFFIX)
    ) {
      return OSSSTORE_PATH;
    }
    return orig.call(this, request, parent, ...rest);
  };
  return () => {
    Module._resolveFilename = orig;
  };
}

function loadManager(auth) {
  const calls = { ossStoreCtors: [], endpoints: [] };

  class FakeOssStore {
    constructor(cfg) {
      calls.ossStoreCtors.push(cfg);
      this.cfg = cfg;
    }
    createDownloadJob(opt) {
      return { opt, status: 'finished', on() {}, stop() {}, start() {} };
    }
  }
  stubModuleByPath(OSSSTORE_PATH, FakeOssStore);

  const ossSvs2 = {
    getOssEndpoint(region, bucket, eptpl) {
      calls.endpoints.push({ region, bucket, eptpl });
      return `EP(${region},${bucket},${eptpl})`;
    },
  };

  const reg = stubAngular();
  reg.services.$q = {};
  reg.services.$state = { go() {} };
  reg.services.$timeout = function () {};
  reg.services.AuthInfo = { get: () => auth };
  reg.services.ossSvs2 = ossSvs2;
  reg.services.Toast = { error() {} };
  reg.services.Const = {};
  reg.services.DelayDone = { delayRun() {} };
  reg.services.safeApply = function () {};
  reg.services.settingsSvs = { maxDownloadJobCount: { get: () => 3 } };

  reg.load('app/components/services/prog-naming.js');
  reg.load('app/components/services/oss-download-manager.js');

  return { reg, calls };
}

function setup(t, auth) {
  const restoreResolve = patchOssstoreResolve();
  const origHomedir = os.homedir;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'osb-dlmgr-'));
  os.homedir = () => tmpHome;
  t.teardown(() => {
    os.homedir = origHomedir;
    restoreResolve();
    unstubAll();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  const { reg, calls } = loadManager(auth);
  const mgr = reg.get('ossDownloadManager');
  mgr.init({
    lists: { downloadJobList: [] },
    calcTotalProg() {},
    retryTimes: 0,
  });
  return { mgr, calls };
}

function driveCreateJob(mgr, toLocalPath) {
  mgr.createDownloadJobs(
    [
      {
        region: 'cn-hangzhou',
        bucket: 'bkt-src',
        path: '/dir/f.txt',
        name: 'f.txt',
        isFolder: false,
      },
    ],
    toLocalPath,
    function () {}
  );
}

test('STS 分支 endpoint 取 opt.from.bucket（下载源 bucket，修复锚点）', (t) => {
  const { mgr, calls } = setup(t, {
    id: 'STS.abc123',
    secret: 'sk',
    stoken: 'tok-1',
    cname: false,
    eptpl: 'http://{region}.aliyuncs.com',
    eptplcname: 'http://cname.example.com',
  });
  driveCreateJob(mgr, path.join(os.tmpdir(), 'osb-dl-target'));

  t.is(calls.endpoints.length, 1, '恰好构造一次 OssStore');
  t.is(calls.endpoints[0].bucket, 'bkt-src', 'endpoint bucket 必须取 opt.from.bucket（下载源）');
  t.is(calls.endpoints[0].region, 'cn-hangzhou');
  t.is(calls.endpoints[0].eptpl, 'http://{region}.aliyuncs.com');
  t.is(
    calls.ossStoreCtors[0].endpoint,
    'EP(cn-hangzhou,bkt-src,http://{region}.aliyuncs.com)',
    'OssStore endpoint 必须为 getOssEndpoint(from.bucket) 的返回值'
  );
  t.is(calls.ossStoreCtors[0].stsToken.Credentials.SecurityToken, 'tok-1');
  t.is(calls.ossStoreCtors[0].cname, false);
});

test('非 STS 分支 endpoint 取 opt.from.bucket（基线锁定）', (t) => {
  const { mgr, calls } = setup(t, {
    id: 'LTAI5tFake',
    secret: 'sk',
    stoken: null,
    cname: false,
    eptpl: 'http://{region}.aliyuncs.com',
    eptplcname: 'http://cname.example.com',
  });
  driveCreateJob(mgr, path.join(os.tmpdir(), 'osb-dl-target'));

  t.is(calls.endpoints.length, 1);
  t.is(calls.endpoints[0].bucket, 'bkt-src');
  t.is(calls.ossStoreCtors[0].aliyunCredential.accessKeyId, 'LTAI5tFake');
  t.is(calls.ossStoreCtors[0].aliyunCredential.secretAccessKey, 'sk');
  t.is(calls.ossStoreCtors[0].endpoint, 'EP(cn-hangzhou,bkt-src,http://{region}.aliyuncs.com)');
});

test('cname 开启时 endpoint 模板取 eptplcname', (t) => {
  const { mgr, calls } = setup(t, {
    id: 'LTAI5tFake',
    secret: 'sk',
    stoken: null,
    cname: true,
    eptpl: 'http://{region}.aliyuncs.com',
    eptplcname: 'http://cname.example.com',
  });
  driveCreateJob(mgr, path.join(os.tmpdir(), 'osb-dl-target'));

  t.is(calls.endpoints.length, 1);
  t.is(calls.endpoints[0].bucket, 'bkt-src');
  t.is(calls.endpoints[0].eptpl, 'http://cname.example.com');
  t.is(calls.ossStoreCtors[0].cname, true);
});