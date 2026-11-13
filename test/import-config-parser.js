import test from 'ava';
import parser from '../app/main/auth/import-config-parser';

const ID = 'STS.NYjnAQjmQWRhmNXDhiYCpTgMP';
const SECRET = '61kjGMYXcMzZFKwaMKHVoU11vwPfgB3DL5pUnoMKfnbM';
const TOKEN = 'CAISpQV1q6Ft5B2yfSjIr5rfJfvlh7Jw4JCDb2jpoGg8Vcxcu6';
const OSSPATH =
  'oss://ric-cdp-har-vca-qua/web/cdp_vca/pt=20261015/for_RWF_ws_2026-10-15.gz';

// 用户样例 1: JSON 嵌套格式(接口响应, 配置在 data 里)
const NESTED_JSON = JSON.stringify({
  code: 200,
  message: 'Success',
  success: true,
  traceId: null,
  localDateTime: '2026-10-16 09:48:09',
  data: {
    code: 0,
    success: true,
    message: null,
    accessKeyId: ID,
    accessKeySecret: SECRET,
    securityToken: TOKEN,
    expiration: '2026-10-16T13:48:09Z',
    ossPath: OSSPATH,
    traceId: 'b8f70978303e4a06a6ba90e8e2db85e6',
    params: null
  },
  resultData: null,
  timestamp: 0
});

// 用户样例 2: JSON 扁平格式
const FLAT_JSON = JSON.stringify({
  code: 0,
  success: true,
  message: null,
  accessKeyId: ID,
  accessKeySecret: SECRET,
  securityToken: TOKEN,
  expiration: '2026-10-16T13:48:09Z',
  ossPath: OSSPATH,
  traceId: 'b8f70978303e4a06a6ba90e8e2db85e6',
  params: null
});

function assertFullConfig(t, data) {
  t.is(data.id, ID);
  t.is(data.secret, SECRET);
  t.is(data.stoken, TOKEN);
  t.is(data.osspath, OSSPATH);
  t.is(data.expiration, undefined);
  t.is(data.traceId, undefined);
}

test('parse nested JSON from api response', (t) => {
  const r = parser.parse(NESTED_JSON);

  t.is(r.type, 'json');
  assertFullConfig(t, r.data);
});

test('parse flat JSON', (t) => {
  const r = parser.parse(FLAT_JSON);

  t.is(r.type, 'json');
  assertFullConfig(t, r.data);
});

test('parse JSON with trailing comma', (t) => {
  const r = parser.parse(FLAT_JSON.replace(/}$/, ',}'));

  t.is(r.type, 'json');
  t.is(r.data.id, ID);
});

test('parse pretty printed JSON', (t) => {
  const r = parser.parse(JSON.stringify(JSON.parse(NESTED_JSON), null, 2));

  assertFullConfig(t, r.data);
});

test('parse XML', (t) => {
  const text = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<response>',
    '  <code>200</code>',
    '  <data>',
    '    <accessKeyId>' + ID + '</accessKeyId>',
    '    <accessKeySecret>' + SECRET + '</accessKeySecret>',
    '    <securityToken>' + TOKEN + '</securityToken>',
    '    <ossPath>' + OSSPATH + '</ossPath>',
    '  </data>',
    '</response>'
  ].join('\n');

  const r = parser.parse(text);

  t.is(r.type, 'xml');
  assertFullConfig(t, r.data);
});

test('parse key:value lines', (t) => {
  const text = [
    'accessKeyId: ' + ID,
    'accessKeySecret: ' + SECRET,
    'securityToken: ' + TOKEN,
    'ossPath: ' + OSSPATH
  ].join('\n');

  const r = parser.parse(text);

  t.is(r.type, 'text');
  assertFullConfig(t, r.data);
});

test('parse key=value lines with quotes', (t) => {
  const text = [
    'accessKeyId = "' + ID + '"',
    "accessKeySecret = '" + SECRET + "'",
    'securityToken = ' + TOKEN + ',',
    'ossPath = ' + OSSPATH
  ].join('\n');

  const r = parser.parse(text);

  assertFullConfig(t, r.data);
});

test('parse yaml with nested indentation', (t) => {
  const text = [
    'code: 200',
    'message: Success',
    'data:',
    '  accessKeyId: ' + ID,
    '  accessKeySecret: ' + SECRET,
    '  securityToken: ' + TOKEN,
    '  ossPath: ' + OSSPATH,
    '  expiration: 2026-10-16T13:48:09Z'
  ].join('\n');

  const r = parser.parse(text);

  assertFullConfig(t, r.data);
});

test('parse yaml with quoted keys', (t) => {
  const text = [
    '"accessKeyId": "' + ID + '",',
    '"accessKeySecret": "' + SECRET + '",',
    '"securityToken": "' + TOKEN + '",'
  ].join('\n');

  const r = parser.parse(text);

  t.is(r.data.id, ID);
  t.is(r.data.secret, SECRET);
  t.is(r.data.stoken, TOKEN);
});

test('parse lines copied from pretty JSON', (t) => {
  const pretty = JSON.stringify(JSON.parse(FLAT_JSON), null, 2);
  const r = parser.parse(pretty.replace(/^{/, '').replace(/}$/, ''));

  t.is(r.type, 'text');
  assertFullConfig(t, r.data);
});

test('parse underscore and camel aliases', (t) => {
  const r = parser.parse(
    [
      'access_key_id: ' + ID,
      'access_key_secret: ' + SECRET,
      'security_token: ' + TOKEN,
      'oss_path: ' + OSSPATH
    ].join('\n')
  );

  assertFullConfig(t, r.data);
});

test('import endpoint only when it is a valid url', (t) => {
  const r1 = parser.parse('endpoint: oss-cn-hangzhou.aliyuncs.com\n' +
    'accessKeyId: ' + ID + '\naccessKeySecret: ' + SECRET);

  t.is(r1.data.eptpl, undefined);

  const r2 = parser.parse('endpoint: https://oss-cn-hangzhou.aliyuncs.com\n' +
    'accessKeyId: ' + ID + '\naccessKeySecret: ' + SECRET);

  t.is(r2.data.eptpl, 'https://oss-cn-hangzhou.aliyuncs.com');
});

test('empty text returns empty error', (t) => {
  t.is(parser.parse('').error, 'empty');
  t.is(parser.parse('   \n  ').error, 'empty');
  t.is(parser.parse(null).error, 'empty');
});

test('json without config fields returns notFound', (t) => {
  const r = parser.parse(JSON.stringify({
    code: 200,
    message: 'Success',
    data: { foo: 'bar' }
  }));

  t.is(r.error, 'notFound');
});

test('plain text without config fields returns notFound', (t) => {
  t.is(parser.parse('hello world this is not a config').error, 'notFound');
});