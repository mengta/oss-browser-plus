'use strict';

// A-10（P6c · R-P6-07）：OSS 拆分前后 manifest 方法与实现集合零差异。
import test from 'ava';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const manifest = require('../../../app/preload/api-manifest.js');
const oss = require('../../../node/capabilities/services/oss/index.js');

test('A-10：manifest 声明的 OSS 方法均有实现', (t) => {
  const methods = manifest.domains.oss.methods;
  const declared = Object.keys(methods).filter(
    (name) => name !== 'probeUrl' && methods[name].expose !== false
  );
  const missing = declared.filter((name) => typeof oss[name] !== 'function');
  t.deepEqual(missing, []);
});

test('A-10：OSS 实现方法与 manifest 方法集合一致', (t) => {
  const declared = Object.keys(manifest.domains.oss.methods)
    .filter((name) => name !== 'probeUrl')
    .sort();
  const implemented = Object.keys(oss).sort();
  t.deepEqual(implemented, declared);
});