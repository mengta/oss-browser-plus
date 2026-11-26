import { describe, it, expect } from 'vitest';
import { compareVersion } from '@renderer/services/compare-version.js';

describe('compare-version', () => {
  it('相同版本返回 0', () => {
    expect(compareVersion('1.2.3', '1.2.3')).toBe(0);
  });

  it('按段位数值比较（非字符串字典序）', () => {
    expect(compareVersion('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersion('1.9.9', '1.10.0')).toBe(-1);
    expect(compareVersion('2.0.0', '1.99.99')).toBe(1);
  });

  it('前段相同时比较后段', () => {
    expect(compareVersion('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersion('1.2.10', '1.2.4')).toBe(1);
  });

  it('段数不一致时缺失段按 NaN 处理，视为相等', () => {
    expect(compareVersion('1.2', '1.2.0')).toBe(0);
    expect(compareVersion('1.2.3', '1.2')).toBe(0);
  });

  it('非数字前缀退化但不抛错', () => {
    expect(compareVersion('v1.2.3', 'v1.2.3')).toBe(0);
    expect(compareVersion('foo', 'bar')).toBe(0);
  });

  it('支持数值入参（内部转字符串）', () => {
    expect(compareVersion(1.2, '1.2.0')).toBe(0);
    expect(compareVersion(2, '1.9')).toBe(1);
  });
});