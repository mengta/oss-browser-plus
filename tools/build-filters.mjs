// P1（R-P1-02）：构建裁剪谓词（可单测，build.mjs 与 test/unit 共用）。
// crc64 仅保留目标平台预编译产物 + pure-js 兜底；cpp-addon 未被 index.js 加载，不入 dist；
// 平台目录内仅保留 Release/*.node（排除 obj/、pdb、map、lib、exp 与工程文件）。

export function crc64Filter(rel, targetDir) {
  const seg = rel.split('/');
  if (seg[0] !== 'crc64') return true;
  if (seg.length === 2 && (seg[1] === 'index.js' || seg[1] === 'fork.js')) return true;
  if (seg[1] === 'pure-js') return true;
  if (seg[1] === 'electron-crc64-prebuild') {
    if (seg.length === 3 && ['index.js', 'package.json', 'Readme.md'].includes(seg[2])) return true;
    if (seg[2] === 'lib') {
      if (seg.length === 4 && seg[3] === 'index.js') return true;
      if (seg.length > 4 && seg[3] === targetDir) {
        return /^Release\/[^/]+\.node$/.test(seg.slice(4).join('/'));
      }
      return false;
    }
    return false;
  }
  return false;
}