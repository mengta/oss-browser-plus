'use strict';

// P6b（R-P6-01/R-P6-06）：RAM 服务去 Angular 化。
// 18 个方法首参统一为 ctx（{ auth: {id,secret} }）；原生 Promise；错误归一化保留 code/message，
// 登录跳转与 toast 由渲染层依据错误码处理（主进程不做 UI 动作）。
var log = require('../../lib/logger').logger('capabilities.ram');
var ALYD = require('../sdk/aliyun-sdk-adapter');

function codedError(code, message) {
  var err = new Error(message || code);
  err.code = code;
  return err;
}

// 等价原 handleError 的 message 归一化（不 toast / 不跳登录）
function normalizeError(err) {
  var raw = err || {};
  var code = raw.code || 'Error';
  var message = String(raw.message || raw.code || 'unknown error');
  if (!raw.code && message.indexOf('Failed to fetch') !== -1) {
    message = '无法连接';
  } else if (raw.code && message.indexOf('You are not authorized to do this action') !== -1) {
    message = '没有权限, ' + message;
  }
  var out = codedError(code, message);
  if (raw.requestId) out.requestId = raw.requestId;
  if (raw.statusCode) out.statusCode = raw.statusCode;
  return out;
}

function resolveAuth(ctx) {
  var source = ctx && ctx.auth ? ctx.auth : ctx || {};
  var id = source.id || source.accessKeyId;
  var secret = source.secret || source.accessKeySecret;
  if (!id || typeof id !== 'string' || !secret || typeof secret !== 'string') {
    throw codedError('InvalidAccessKeyId', 'auth is required');
  }
  return { id: id, secret: secret };
}

function getClient(ctx) {
  var auth = resolveAuth(ctx);
  return new ALYD.RAM({
    accessKeyId: auth.id,
    secretAccessKey: auth.secret,
    endpoint: 'https://ram.aliyuncs.com',
    apiVersion: '2015-05-01',
  });
}

// 统一回调桥接：SDK 的 (err, result) → Promise，错误归一化
function call(client, method, request, ignoreError) {
  return new Promise(function (resolve, reject) {
    client[method].call(client, request, function (err, result) {
      if (err) {
        if (!ignoreError) log.error('ram.failed', method + ' failed', { code: err && err.code });
        reject(normalizeError(err));
        return;
      }
      resolve(result);
    });
  });
}

// 分页聚合（listUsers/listGroups/listRoles）
function listAll(ctx, callFn, resultKey, ignoreError) {
  var client = getClient(ctx);
  var collected = [];
  return new Promise(function (resolve, reject) {
    function dig(marker) {
      var opt = { MaxItems: 100 };
      if (marker) opt.Marker = marker;
      client[callFn].call(client, opt, function (err, res) {
        if (err) {
          if (!ignoreError) log.error('ram.failed', callFn + ' failed', { code: err && err.code });
          reject(normalizeError(err));
          return;
        }
        var next = res && res.Marker;
        var bucket = res && res[resultKey + 's'];
        collected = collected.concat((bucket && bucket[resultKey]) || []);
        if (next) dig(next);
        else resolve(collected);
      });
    }
    dig();
  });
}

function listPoliciesForUser(ctx, username) {
  return call(getClient(ctx), 'listPoliciesForUser', { UserName: username });
}

function deleteUser(ctx, username) {
  return call(getClient(ctx), 'deleteUser', { UserName: username });
}

function getUser(ctx, username) {
  return call(getClient(ctx), 'getUser', { UserName: username });
}

function updateUser(ctx, item) {
  return call(getClient(ctx), 'updateUser', item);
}

function createUser(ctx, opt) {
  var request = typeof opt === 'string' ? { UserName: opt } : opt;
  log.debug('createUser:', request);
  return call(getClient(ctx), 'createUser', request);
}

function listAccessKeys(ctx, username) {
  return call(getClient(ctx), 'listAccessKeys', { UserName: username });
}

function createAccessKey(ctx, username) {
  return call(getClient(ctx), 'createAccessKey', { UserName: username });
}

function updateAccessKey(ctx, username, userAccessKeyId, status) {
  return call(getClient(ctx), 'updateAccessKey', {
    UserName: username,
    UserAccessKeyId: userAccessKeyId,
    Status: status,
  });
}

function deleteAccessKey(ctx, username, userAccessKeyId) {
  return call(getClient(ctx), 'deleteAccessKey', {
    UserName: username,
    UserAccessKeyId: userAccessKeyId,
  });
}

function createPolicy(ctx, name, doc, desc) {
  return call(getClient(ctx), 'createPolicy', {
    PolicyName: name,
    PolicyDocument: doc,
    Description: desc,
  });
}

function getPolicy(ctx, name, type, ignoreError) {
  return call(getClient(ctx), 'getPolicy', { PolicyName: name, PolicyType: type }, ignoreError);
}

function attachPolicy(ctx, callFn, opt) {
  return call(getClient(ctx), callFn, opt);
}

function attachPolicyToUser(ctx, policyName, userName) {
  return attachPolicy(ctx, 'attachPolicyToUser', {
    PolicyName: policyName,
    UserName: userName,
    PolicyType: 'Custom',
  });
}

function attachPolicyToGroup(ctx, policyName, groupName) {
  return attachPolicy(ctx, 'attachPolicyToGroup', {
    PolicyName: policyName,
    GroupName: groupName,
    PolicyType: 'Custom',
  });
}

function attachPolicyToRole(ctx, policyName, roleName) {
  return attachPolicy(ctx, 'attachPolicyToRole', {
    PolicyName: policyName,
    RoleName: roleName,
    PolicyType: 'Custom',
  });
}

function detachPolicyFromUser(ctx, policyName, userName) {
  return attachPolicy(ctx, 'detachPolicyFromUser', {
    UserName: userName,
    PolicyName: policyName,
    PolicyType: 'Custom',
  });
}

function listUsers(ctx, ignoreError) {
  return listAll(ctx, 'listUsers', 'User', ignoreError);
}

function listGroups(ctx, ignoreError) {
  return listAll(ctx, 'listGroups', 'Group', ignoreError);
}

function listRoles(ctx, ignoreError) {
  return listAll(ctx, 'listRoles', 'Role', ignoreError);
}

module.exports = {
  listUsers: listUsers,
  listGroups: listGroups,
  listRoles: listRoles,

  createPolicy: createPolicy,
  getPolicy: getPolicy,
  attachPolicyToRole: attachPolicyToRole,
  attachPolicyToGroup: attachPolicyToGroup,
  attachPolicyToUser: attachPolicyToUser,
  detachPolicyFromUser: detachPolicyFromUser,
  listPoliciesForUser: listPoliciesForUser,

  getUser: getUser,
  createUser: createUser,
  updateUser: updateUser,
  deleteUser: deleteUser,

  createAccessKey: createAccessKey,
  updateAccessKey: updateAccessKey,
  deleteAccessKey: deleteAccessKey,
  listAccessKeys: listAccessKeys,
};