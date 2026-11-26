// UTF-8 安全的 Base64 编码（渲染层无 Node Buffer；授权码/邮件内容需要）
export function base64Encode(text) {
  const str = String(text == null ? '' : text);
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }
  // 兜底（无 TextEncoder 的环境）
  return btoa(unescape(encodeURIComponent(str)));
}

// 二进制（Uint8Array/Buffer）→ Base64（图片预览 data URL 用）
export function base64FromBytes(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}