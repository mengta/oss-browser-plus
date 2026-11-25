// 等价 Angular fileSvs.getFileType（file.s.js 语义保持）：
// ext → picture | video | audio | doc | code | others。
// code 判定原依赖 CM5 findModeByExtension；Vue 版（CM6）改为静态扩展名映射，
// 覆盖原 mode 列表常用面（B3-12 代码预览迁移时按需增补）。

// IMM 预览支持的文档类型（app/const.js IMM_DOC_TYPES 语义保持，当前清单仅 pdf）
const IMM_DOC_TYPES = ['pdf'];

// 静态 code 扩展名映射（来源：CodeMirror5 mode/index.js findModeByExtension 常用子集）
const CODE_MODES = {
  js: { name: 'JavaScript', mime: 'text/javascript' },
  mjs: { name: 'JavaScript', mime: 'text/javascript' },
  ts: { name: 'TypeScript', mime: 'application/typescript' },
  jsx: { name: 'JSX', mime: 'text/jsx' },
  tsx: { name: 'TypeScript', mime: 'application/typescript' },
  json: { name: 'JSON', mime: 'application/json' },
  html: { name: 'HTML', mime: 'text/html' },
  htm: { name: 'HTML', mime: 'text/html' },
  xml: { name: 'XML', mime: 'application/xml' },
  css: { name: 'CSS', mime: 'text/css' },
  scss: { name: 'SASS', mime: 'text/x-scss' },
  less: { name: 'Less', mime: 'text/x-less' },
  md: { name: 'markdown', mime: 'text/x-markdown' },
  markdown: { name: 'markdown', mime: 'text/x-markdown' },
  py: { name: 'Python', mime: 'text/x-python' },
  java: { name: 'Java', mime: 'text/x-java' },
  c: { name: 'C', mime: 'text/x-csrc' },
  h: { name: 'C', mime: 'text/x-csrc' },
  cpp: { name: 'C++', mime: 'text/x-c++src' },
  cc: { name: 'C++', mime: 'text/x-c++src' },
  hpp: { name: 'C++', mime: 'text/x-c++src' },
  cs: { name: 'C#', mime: 'text/x-csharp' },
  go: { name: 'Go', mime: 'text/x-go' },
  rs: { name: 'Rust', mime: 'text/x-rustsrc' },
  rb: { name: 'Ruby', mime: 'text/x-ruby' },
  php: { name: 'PHP', mime: 'application/x-httpd-php' },
  sh: { name: 'Shell', mime: 'application/x-sh' },
  bash: { name: 'Shell', mime: 'application/x-sh' },
  yaml: { name: 'YAML', mime: 'text/x-yaml' },
  yml: { name: 'YAML', mime: 'text/x-yaml' },
  sql: { name: 'SQL', mime: 'application/x-sql' },
  lua: { name: 'Lua', mime: 'text/x-lua' },
  swift: { name: 'Swift', mime: 'text/x-swift' },
  kt: { name: 'Kotlin', mime: 'text/x-kotlin' },
  dart: { name: 'Dart', mime: 'application/dart' },
  vue: { name: 'Vue', mime: 'text/x-vue' },
  ini: { name: 'Properties', mime: 'text/x-properties' },
  properties: { name: 'Properties', mime: 'text/x-properties' },
  toml: { name: 'TOML', mime: 'text/x-toml' },
  diff: { name: 'Diff', mime: 'text/x-diff' },
  patch: { name: 'Diff', mime: 'text/x-diff' },
};

export function getFileType(item) {
  const name = (item && item.name) || '';
  const ext =
    name.indexOf('.') !== -1
      ? name.toLowerCase().substring(name.lastIndexOf('.') + 1)
      : '';

  if (IMM_DOC_TYPES.indexOf(ext) !== -1) {
    return { type: 'doc', ext: [ext] };
  }

  switch (ext) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return { type: 'picture', ext: [ext] };
    case 'mp4':
      return { type: 'video', ext: [ext], mineType: 'video/mp4' };
    case 'webm':
      return { type: 'video', ext: [ext], mineType: 'video/webm' };
    case 'mov':
      return { type: 'video', ext: [ext], mineType: 'video/quicktime' };
    case 'ogv':
      return { type: 'video', ext: [ext], mineType: 'video/ogg' };
    case 'flv':
      return { type: 'video', ext: [ext], mineType: 'video/x-flv' };
    case 'mp3':
      return { type: 'audio', ext: [ext], mineType: 'audio/mp3' };
    case 'ogg':
      return { type: 'audio', ext: [ext], mineType: 'audio/ogg' };
    default:
      break;
  }

  const codeMode = CODE_MODES[ext];
  if (codeMode) {
    return Object.assign({}, codeMode, { type: 'code', ext: [ext] });
  }

  return { type: 'others', ext: [ext] };
}

export default { getFileType };