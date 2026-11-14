angular.module('web').factory('ProgNaming', [function() {
  // ProgNaming：进度文件脱敏命名纯函数（credential-security design I-4 / D-6）。
  // 新名 = 前缀 + sha256(AccessKeyId) hex 前 16 字符 + '.json'（不可逆、确定性）；
  // 旧名仅供 loadProg 迁移探测与孤儿补删，禁止用于新写入。
  var crypto = require('crypto');

  function newProgFileName(prefix, ak) {
    var hash = crypto
        .createHash('sha256')
        .update(String(ak == null ? '' : ak), 'utf8')
        .digest('hex');
    return prefix + hash.slice(0, 16) + '.json';
  }

  function legacyProgFileName(prefix, ak) {
    return prefix + String(ak == null ? '' : ak) + '.json';
  }

  return {
    newProgFileName: newProgFileName,
    legacyProgFileName: legacyProgFileName
  };
}]);