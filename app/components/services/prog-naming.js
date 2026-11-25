angular.module('web').factory('ProgNaming', [function() {
  // ProgNaming：进度文件脱敏命名纯函数（credential-security design I-4 / D-6）。
  // Vue3-P0-16：sha256 改经 digest 白名单（同步），渲染层不再 require('crypto')。
  function digestApi() {
    if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
    return window.ossBrowser.digest || null;
  }

  function sha256Hex(text) {
    var api = digestApi();
    if (!api) { return ''; }
    var res = api.sha256Hex(text);
    return res && res.ok ? res.data : '';
  }

  function newProgFileName(prefix, ak) {
    var hash = sha256Hex(String(ak == null ? '' : ak));
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