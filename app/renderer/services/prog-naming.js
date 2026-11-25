// 等价 Angular ProgNaming（credential-security I-4 / D-6）：
// sha256 前 16 hex 脱敏命名 + legacy 明文兼容名。digest 白名单同步返回。
function sha256Hex(text) {
  const api =
    typeof window !== 'undefined' && window.ossBrowser
      ? window.ossBrowser.digest
      : null;
  if (!api || typeof api.sha256Hex !== 'function') {
    return '';
  }
  const res = api.sha256Hex(text);
  return res && res.ok ? res.data : '';
}

export function newProgFileName(prefix, ak) {
  const hash = sha256Hex(String(ak == null ? '' : ak));
  return prefix + hash.slice(0, 16) + '.json';
}

export function legacyProgFileName(prefix, ak) {
  return prefix + String(ak == null ? '' : ak) + '.json';
}

export default { newProgFileName, legacyProgFileName };