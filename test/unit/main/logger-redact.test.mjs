'use strict';

// A-04 / A-05（P4）：日志脱敏与轮转。断言敏感键无原文、URL query 脱敏、
// 超限轮转且份数受限、目录不可写不抛错。
import test from 'ava';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { redact, redactText } = require('../../../node/lib/redact.js');
const loggerMod = require('../../../node/lib/logger.js');

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-log-'));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('redact：accessKeyId 前 4 后 4，secret/token 全掩码', (t) => {
  const out = redact({
    accessKeyId: 'LTAI5tABCDEFGHIJ',
    accessKeySecret: 'supersecretvalue',
    securityToken: 'sts-token-value',
    password: 'p@ss',
    nested: { token: 'abc' },
  });
  t.is(out.accessKeyId, 'LTAI****GHIJ');
  t.is(out.accessKeySecret, '***');
  t.is(out.securityToken, '***');
  t.is(out.password, '***');
  t.is(out.nested.token, '***');
});

test('redact：键名大小写无关', (t) => {
  const out = redact({ AccessKeySecret: 'x', AUTHORIZATION: 'Bearer y' });
  t.is(out.AccessKeySecret, '***');
  t.is(out.AUTHORIZATION, '***');
});

test('redactText：URL query 中的签名/令牌被脱敏', (t) => {
  const text = 'GET https://b.oss-cn-hangzhou.aliyuncs.com/o?OSSAccessKeyId=LTAI5tABCDEFGHIJ&Signature=abcdef&Expires=1';
  const out = redactText(text);
  t.false(out.includes('abcdef'));
  t.true(out.includes('Expires=1'));
  t.true(out.includes('LTAI****GHIJ'));
});

test('logger：写入文件包含事件结构且敏感值无原文', (t) => {
  const dir = tmpDir(t);
  loggerMod.init({ dir, consoleLevel: 'error' });
  const log = loggerMod.logger('test.mod');
  log.info('demo.event', 'hello', { accessKeySecret: 'topsecret', accessKeyId: 'LTAI5tABCDEFGHIJ' });

  const file = path.join(dir, 'main.log');
  const text = fs.readFileSync(file, 'utf8');
  t.true(text.includes('demo.event'));
  t.false(text.includes('topsecret'));
  t.true(text.includes('LTAI****GHIJ'));
});

test('logger：超限轮转且份数不超过上限', (t) => {
  const dir = tmpDir(t);
  loggerMod.init({ dir, consoleLevel: 'error', maxBytes: 512, maxFiles: 2 });
  const log = loggerMod.logger('test.rotate');
  for (let i = 0; i < 40; i += 1) {
    log.info('rotate.event', 'x'.repeat(80) + i);
  }
  const files = fs.readdirSync(dir).filter((n) => n.startsWith('main.log'));
  t.true(files.length >= 2, `expected rotation, got ${files.join(',')}`);
  t.true(files.length <= 3, `too many files: ${files.join(',')}`);
});

test('logger：目录不可写时不抛错并退化为控制台', (t) => {
  const dir = tmpDir(t);
  const notADir = path.join(dir, 'file-blocker');
  fs.writeFileSync(notADir, 'x');
  const ok = loggerMod.init({ dir: path.join(notADir, 'logs'), consoleLevel: 'error' });
  t.false(ok);
  loggerMod.logger('test.degraded').info('degraded.event', 'still works');
  t.true(true);
});