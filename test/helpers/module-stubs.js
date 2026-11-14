'use strict';

// 模块替身：向 require.cache 注入进程边界替身（electron / electron-log / nodemailer 等）。
// R-11 边界：仅替身进程/框架边界，业务数据结构用真实实现。
// 注意：注入前会记录原缓存，unstubAll 恢复，避免测试间污染。

const Module = require('module');
const path = require('path');
const saved = [];

function stubModule(moduleId, fakeExports) {
  const resolved = require.resolve(moduleId);
  const mod = new Module(resolved, null);
  mod.filename = resolved;
  mod.exports = fakeExports;
  mod.loaded = true;
  if (!(resolved in require.cache) || require.cache[resolved] !== mod) {
    saved.push({ resolved, prev: require.cache[resolved] });
  }
  require.cache[resolved] = mod;
  return mod;
}

function stubModuleByPath(filePath, fakeExports) {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const mod = new Module(abs, null);
  mod.filename = abs;
  mod.exports = fakeExports;
  mod.loaded = true;
  saved.push({ resolved: abs, prev: require.cache[abs] });
  require.cache[abs] = mod;
  return mod;
}

function unstubAll() {
  while (saved.length) {
    const { resolved, prev } = saved.pop();
    if (prev === undefined) {
      delete require.cache[resolved];
    } else {
      require.cache[resolved] = prev;
    }
  }
}

module.exports = { stubModule, stubModuleByPath, unstubAll };