import { describe, it, expect } from 'vitest';
import { truncate, hideSecret, maskSecret, sub, formatLeftTime } from '@renderer/services/formatters.js';

describe('truncate / sub（等价旧 sub 过滤器）', () => {
  it('短于长度不截断', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  it('等于长度仍追加省略号（旧行为）', () => {
    expect(truncate('abcdef', 6)).toBe('abcdef...');
  });

  it('超长截断加省略号', () => {
    expect(truncate('abcdefghij', 4)).toBe('abcd...');
    expect(sub('abcdefghij', 4)).toBe('abcd...');
  });

  it('空串与非法长度', () => {
    expect(truncate('', 5)).toBe('');
    expect(truncate(null, 5)).toBe('');
    expect(truncate('abc', -1)).toBe('abc');
    expect(truncate('abc', NaN)).toBe('abc');
  });
});

describe('hideSecret / maskSecret（保留首尾 3 字符）', () => {
  it('短于 6 位返回 6 个星号', () => {
    expect(hideSecret('abcde')).toBe('******');
    expect(hideSecret('')).toBe('******');
  });

  it('6 位及以上保留首尾 3 字符', () => {
    expect(hideSecret('abc123')).toBe('abc****123');
    expect(hideSecret('LTAI5tAbCdEfGhIjKlMn')).toBe('LTA****lMn');
    expect(maskSecret('abcdefg')).toBe('abc****efg');
  });
});

describe('formatLeftTime（等价 utilSvs.leftTime）', () => {
  it('NaN 返回空串、非正数返回 0', () => {
    expect(formatLeftTime('abc')).toBe('');
    expect(formatLeftTime(0)).toBe(0);
    expect(formatLeftTime(-5)).toBe(0);
  });

  it('小于 1s 返回 ms', () => {
    expect(formatLeftTime(800)).toBe('800ms');
  });

  it('完整拆分 D/h/m/s 且空格连接', () => {
    const ms = 86400000 + 3600000 + 60000 + 1000;
    expect(formatLeftTime(ms)).toBe('1D 1h 1m 1s');
    expect(formatLeftTime(65000)).toBe('1m 5s');
    expect(formatLeftTime(3600000)).toBe('1h');
  });
});