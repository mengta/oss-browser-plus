'use strict';

// 登录回归：渲染层 auth-info {id,secret,stoken} → 主进程 {accessKeyId,accessKeySecret,securityToken}
import test from 'ava';
import { createRequire } from 'module';
import { stubLocalStorage } from '../../../helpers/env-stubs.js';

const require = createRequire(import.meta.url);

function load() {
  stubLocalStorage({});
  return require('../../../../node/capabilities/dispatch.js');
}

test('normalizeAuth：auth-info 字段映射到 accessKeyId/accessKeySecret/securityToken', (t) => {
  const { normalizeAuth } = load();
  const out = normalizeAuth({ id: 'LTAI-test', secret: 'sk-test', stoken: 'tok-test', region: 'oss-cn-hangzhou' });
  t.is(out.accessKeyId, 'LTAI-test');
  t.is(out.accessKeySecret, 'sk-test');
  t.is(out.securityToken, 'tok-test');
  // 保留原字段（oss2 仍读取 id/secret/requestpaystatus）
  t.is(out.id, 'LTAI-test');
  t.is(out.secret, 'sk-test');
  t.is(out.region, 'oss-cn-hangzhou');
});

test('normalizeAuth：已是新格式时保持不变；空值安全', (t) => {
  const { normalizeAuth } = load();
  const out = normalizeAuth({ accessKeyId: 'AK', accessKeySecret: 'SK', securityToken: 'TOK' });
  t.is(out.accessKeyId, 'AK');
  t.is(out.accessKeySecret, 'SK');
  t.is(out.securityToken, 'TOK');

  const empty = normalizeAuth(null);
  t.is(empty.accessKeyId, '');
  t.is(empty.accessKeySecret, '');
  t.is(empty.securityToken, '');
});

test('normalizeAuth：accessKeyId 优先于 id（避免双格式混用时被旧字段覆盖）', (t) => {
  const { normalizeAuth } = load();
  const out = normalizeAuth({ id: 'old', secret: 's1', accessKeyId: 'new', accessKeySecret: 's2' });
  t.is(out.accessKeyId, 'new');
  t.is(out.accessKeySecret, 's2');
});