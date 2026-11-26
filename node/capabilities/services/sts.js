'use strict';

// P6a（R-P6-01/R-P6-06）：STS 服务去 Angular 化。
// 显式上下文 ctx（{ auth }）+ 原生 Promise；错误归一化保留 code/message 语义，
// 登录跳转与 toast 由渲染层依据错误码处理（不在主进程做 UI 动作）。
const ALYD = require('../sdk/aliyun-sdk-adapter');

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

// 等价原 handleError：InvalidAccessKeyId 原样保留 code（渲染层据此回登录页）；
// 无 code 且 Failed to fetch → Error/无法连接；权限不足 → Error/没有权限, <message>。
function normalizeError(err) {
  const raw = err || {};
  const code = raw.code || 'Error';
  let message = String(raw.message || raw.code || 'unknown error');
  if (!raw.code && message.indexOf('Failed to fetch') !== -1) {
    message = '无法连接';
  } else if (raw.code && message.indexOf('You are not authorized to do this action') !== -1) {
    message = '没有权限, ' + message;
  }
  const out = codedError(code, message);
  if (raw.requestId) out.requestId = raw.requestId;
  if (raw.statusCode) out.statusCode = raw.statusCode;
  return out;
}

function resolveAuth(ctx) {
  const source = ctx && ctx.auth ? ctx.auth : ctx || {};
  const id = source.id || source.accessKeyId;
  const secret = source.secret || source.accessKeySecret;
  if (!id || typeof id !== 'string' || !secret || typeof secret !== 'string') {
    throw codedError('InvalidAccessKeyId', 'auth is required');
  }
  return { id: id, secret: secret };
}

function createClient(auth) {
  return new ALYD.STS({
    accessKeyId: auth.id,
    secretAccessKey: auth.secret,
    endpoint: 'https://sts.aliyuncs.com',
    apiVersion: '2015-04-01',
  });
}

/**
 * @param ctx { auth: {id,secret} } 显式凭证上下文
 * @param roleArn 角色 ID（acs:ram::<account>:role/<name>）
 * @param policyStr 附加权限限制（JSON 字符串）
 * @param seconds 有效期（900~3600，默认 3600）
 */
function assumeRole(ctx, roleArn, policyStr, seconds) {
  return new Promise((resolve, reject) => {
    if (typeof roleArn !== 'string' || !roleArn) {
      reject(codedError('INVALID_ARG', 'roleArn is required'));
      return;
    }
    let client;
    try {
      client = createClient(resolveAuth(ctx));
    } catch (err) {
      reject(normalizeError(err));
      return;
    }
    client.assumeRole(
      {
        Action: 'AssumeRole',
        RoleArn: roleArn,
        Policy: policyStr,
        DurationSeconds: seconds || 3600,
        RoleSessionName: 'oss-browser',
      },
      function (err, result) {
        if (err) {
          reject(normalizeError(err));
        } else {
          resolve(result);
        }
      }
    );
  });
}

module.exports = { assumeRole };