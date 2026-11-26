// 简化 Policy 生成（等价 grant-modal.js / grant-token-modal.js 的 genPolicy）。
// variant：grant（简化授权，读写含 AbortMultipartUpload）/ token（生成授权码，读写含 DeleteObject）。
const ACTIONS = {
  grant: {
    readOnly: ['oss:Get*', 'oss:List*'],
    readWrite: ['oss:Get*', 'oss:List*', 'oss:Put*', 'oss:AbortMultipartUpload'],
    all: ['oss:*'],
  },
  token: {
    readOnly: ['oss:Get*', 'oss:List*'],
    readWrite: ['oss:Get*', 'oss:List*', 'oss:Put*', 'oss:DeleteObject', 'oss:AbortMultipartUpload'],
    all: ['oss:*'],
  },
};

export function buildPolicy(items, privType, currentInfo, variant) {
  const actions = (ACTIONS[variant || 'grant'] || ACTIONS.grant)[privType] || ACTIONS.grant.readOnly;
  const info = currentInfo || {};
  const statement = [];

  for (const item of items || []) {
    if (!item) continue;
    if (item.region || item.isFolder) {
      const bucket = item.region ? item.name : info.bucket;
      const key = item.path || '';
      statement.push({
        Effect: 'Allow',
        Action: ['oss:ListObjects'],
        Resource: ['acs:oss:*:*:' + bucket],
        Condition: { StringLike: { 'oss:Prefix': key + '*' } },
      });
      statement.push({
        Effect: 'Allow',
        Action: actions,
        Resource: ['acs:oss:*:*:' + bucket + '/' + key + '*'],
      });
    } else {
      statement.push({
        Effect: 'Allow',
        Action: ['oss:ListObjects'],
        Resource: ['acs:oss:*:*:' + info.bucket],
        Condition: { StringLike: { 'oss:Prefix': item.path } },
      });
      statement.push({
        Effect: 'Allow',
        Action: actions,
        Resource: ['acs:oss:*:*:' + info.bucket + '/' + item.path],
      });
    }
  }

  return { Version: '1', Statement: statement };
}

export function buildPolicyName(items, privType) {
  const list = items || [];
  const suffix =
    list.length === 1 && list[0] && list[0].name
      ? list[0].name
      : String(Math.random()).substring(2);
  return 'plc-' + privType + '-' + suffix;
}