// 预览相关纯函数（等价 others-modal.js shouldShowAsCodeBtn 的扩展名排除语义）
const BINARY_EXTENSIONS = [
  '.tar.gz',
  '.tar',
  '.zip',
  '.bz',
  '.xz',
  '.dmg',
  '.pkg',
  '.apk',
  '.exe',
  '.msi',
  '.dll',
  '.chm',
  '.iso',
  '.img',
  '.pdf',
  '.doc',
  '.docx',
];

// 返回 true 表示允许“尝试作为文本文件打开”
export function canPreviewAsCode(name) {
  const s = String(name || '').toLowerCase();
  if (!s) return false;
  return !BINARY_EXTENSIONS.some((ext) => s.lastIndexOf(ext) === s.length - ext.length);
}