import { describe, it, expect } from 'vitest';
import { parse, FIELD_LABELS } from '@renderer/services/import-config-parser.js';

describe('import-config-parser', () => {
  it('JSON 扁平：字段别名归一', () => {
    const r = parse('{"AccessKeyId":"LTAI5tX","AccessKeySecret":"sec","Region":"oss-cn-hangzhou"}');
    expect(r.type).toBe('json');
    expect(r.data).toEqual({ id: 'LTAI5tX', secret: 'sec', region: 'oss-cn-hangzhou' });
  });

  it('JSON 嵌套 data：递归展开并取末段别名', () => {
    const r = parse('{"code":200,"data":{"accessKeyId":"STS.nb","securityToken":"tok"}}');
    expect(r.type).toBe('json');
    expect(r.data.id).toBe('STS.nb');
    expect(r.data.stoken).toBe('tok');
  });

  it('XML 解析', () => {
    const r = parse('<root><accessKeyId>STS.x</accessKeyId><accessKeySecret>s1</accessKeySecret></root>');
    expect(r.type).toBe('xml');
    expect(r.data).toEqual({ id: 'STS.x', secret: 's1' });
  });

  it('key:value / key=value 逐行解析（含注释与空行）', () => {
    const text = '# comment\nAccessKeyId=AK1\nAccessKeySecret: SK1\n\nregion=oss-cn-beijing';
    const r = parse(text);
    expect(r.type).toBe('text');
    expect(r.data).toEqual({ id: 'AK1', secret: 'SK1', region: 'oss-cn-beijing' });
  });

  it('YAML 缩进文本同样命中逐行解析', () => {
    const r = parse('accessKeyId: AK2\naccessKeySecret: "SK2"\n');
    expect(r.type).toBe('text');
    expect(r.data.id).toBe('AK2');
    expect(r.data.secret).toBe('SK2');
  });

  it('空内容返回 empty，无字段返回 notFound', () => {
    expect(parse('').error).toBe('empty');
    expect(parse('   ').error).toBe('empty');
    expect(parse('hello world').error).toBe('notFound');
  });

  it('非 http(s) endpoint 被清洗不导入', () => {
    const r = parse('{"accessKeyId":"AK3","accessKeySecret":"SK3","endpoint":"ftp://x"}');
    expect(r.data.eptpl).toBeUndefined();
    const ok = parse('{"accessKeyId":"AK4","accessKeySecret":"SK4","endpoint":"https://oss.aliyuncs.com"}');
    expect(ok.data.eptpl).toBe('https://oss.aliyuncs.com');
  });

  it('字段标签表与旧实现一致', () => {
    expect(FIELD_LABELS).toEqual({
      id: 'AccessKeyId',
      secret: 'AccessKeySecret',
      stoken: 'STS Token',
      osspath: 'Preset OSS Path',
      region: 'Region',
      eptpl: 'Endpoint',
      desc: 'Description',
    });
  });
});