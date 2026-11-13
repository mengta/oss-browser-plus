/**
 * 一键导入配置解析器(纯函数, 不依赖框架)
 * 支持格式:
 *   1. JSON (含嵌套 data, 如接口响应 {"code":200,"data":{...配置...}})
 *   2. JSON (扁平, 直接是配置字段)
 *   3. XML  (<accessKeyId>STS.xxx</accessKeyId>)
 *   4. key:value / key=value (每行一条)
 *   5. YAML (缩进嵌套)
 * 目标字段: AccessKeyId / AccessKeySecret / SecurityToken / OssPath / Region / Endpoint / Description
 */
(function(global) {
  'use strict';

  // 归一化 key(小写、去空格/引号/下划线/点/横线/冒号) -> 表单字段
  var FIELD_ALIASES = {
    accesskeyid: 'id',
    accesskey: 'id',
    accesskeysecret: 'secret',
    secretaccesskey: 'secret',
    securitytoken: 'stoken',
    ststoken: 'stoken',
    stoken: 'stoken',
    osspath: 'osspath',
    presetosspath: 'osspath',
    ossurl: 'osspath',
    region: 'region',
    regionid: 'region',
    endpoint: 'eptpl',
    eptpl: 'eptpl',
    desc: 'desc',
    description: 'desc',
    remark: 'desc'
  };

  var FIELD_LABELS = {
    id: 'AccessKeyId',
    secret: 'AccessKeySecret',
    stoken: 'STS Token',
    osspath: 'Preset OSS Path',
    region: 'Region',
    eptpl: 'Endpoint',
    desc: 'Description'
  };

  function normalizeKey(key) {
    return String(key)
        .toLowerCase()
        .replace(/[\s"'`_.:\-]/g, '');
  }

  function cleanValue(value) {
    if (value === null || value === undefined) { return ''; }

    var v = String(value).trim();

    // 去行尾逗号(key:value 直接从 JSON 拆行复制的情况)
    while (v.charAt(v.length - 1) === ',') {
      v = v.substring(0, v.length - 1).trim();
    }

    // 去成对引号
    if (v.length >= 2) {
      var first = v.charAt(0);
      var last = v.charAt(v.length - 1);

      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        v = v.substring(1, v.length - 1).trim();
      }
    }

    return v;
  }

  // 深度优先展开对象树, key 用路径表示(如 "data.accessKeyId"), 外层字段优先
  function flattenObject(obj, prefix, out, depth) {
    if (depth > 10) { return; }

    Object.keys(obj).forEach(function(key) {
      var value = obj[key];

      if (value === null || value === undefined) { return; }

      var path = prefix ? prefix + '.' + key : key;

      if (typeof value === 'object' && !Array.isArray(value)) {
        flattenObject(value, path, out, depth + 1);
      } else if (typeof value !== 'object') {
        if (out[path] === undefined) {
          out[path] = value;
        }
      }
    });
  }

  // 按路径末段匹配别名
  function pickFields(kv) {
    var out = {};

    Object.keys(kv).forEach(function(path) {
      var segs = path.split('.');
      var field = FIELD_ALIASES[normalizeKey(segs[segs.length - 1])];

      if (!field || out[field]) { return; }

      var value = cleanValue(kv[path]);

      if (value) { out[field] = value; }
    });

    return Object.keys(out).length ? out : null;
  }

  function sanitize(data) {
    // endpoint 必须是合法 URL 才导入, 避免表单校验失败
    if (data.eptpl && !/^https?:\/\//i.test(data.eptpl)) {
      delete data.eptpl;
    }

    return data;
  }

  function unescapeXml(s) {
    return String(s)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
  }

  function parseXml(text) {
    var kv = {};
    var re = /<([\w:.-]+)(?:\s[^>]*)?>\s*([^<]*?)\s*<\/\1>/g;
    var m;

    while ((m = re.exec(text)) !== null) {
      var value = unescapeXml(m[2]);

      if (value) { kv[m[1]] = value; }
    }

    return kv;
  }

  function parseLines(text) {
    var kv = {};

    text.split(/\r?\n/).forEach(function(line) {
      line = line.trim();

      if (!line) { return; }
      if (/^(#|\/\/|;|--|\.\.\.)/.test(line)) { return; } // 注释、YAML文档分隔

      var m = line.match(/^([^=:]{1,128}?)\s*[:=]\s*(.+)$/);

      if (m) {
        var key = m[1].trim().replace(/^["']|["']$/g, '');

        if (key) { kv[key] = m[2].trim(); }
      }
    });

    return kv;
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // 容错: 去掉尾逗号后重试
      try {
        return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
      } catch (e2) {
        return null;
      }
    }
  }

  function parse(text) {
    text = String(text || '').trim();

    if (!text) { return { error: 'empty' }; }

    // 1. JSON(含嵌套 data, 递归查找配置字段)
    if (/^[[{]/.test(text)) {
      var obj = parseJson(text);

      if (obj && typeof obj === 'object') {
        var flat = {};

        flattenObject(obj, '', flat, 0);

        var data = pickFields(flat);

        if (data) { return { type: 'json', data: sanitize(data) }; }

        return { error: 'notFound' };
      }
    }

    // 2. XML
    if (text.charAt(0) === '<' || /<\w[\w:.-]*(\s[^>]*)?>/.test(text)) {
      var dataXml = pickFields(parseXml(text));

      if (dataXml) { return { type: 'xml', data: sanitize(dataXml) }; }
    }

    // 3. YAML / key:value 逐行解析
    var kvLines = parseLines(text);

    if (Object.keys(kvLines).length) {
      var dataLines = pickFields(kvLines);

      if (dataLines) { return { type: 'text', data: sanitize(dataLines) }; }
    }

    return { error: 'notFound' };
  }

  var ImportConfigParser = {
    parse: parse,
    FIELD_LABELS: FIELD_LABELS
  };

  global.ImportConfigParser = ImportConfigParser;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportConfigParser;
  }
})(typeof window !== 'undefined' ? window : global);