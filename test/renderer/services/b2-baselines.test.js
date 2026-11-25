import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { formatDateTime } from '@renderer/services/formatters.js';
import { listFilter } from '@renderer/services/filters.js';
import { sizeFormat } from '@renderer/services/file-size.js';
import { useSettingsStore } from '@renderer/stores/settings.js';
import * as SecureStore from '@renderer/services/secure-store.js';

// 本机时区为 UTC+8（offset -480）；快照断言仅在该时区生效，其余时区退化为
// 「本地时间 Date 手工格式化」等价断言（moment 'YYYY-MM-DD HH:mm:ss' 即本地补零格式化）。
const TZ_IS_CN = new Date().getTimezoneOffset() === -480;

function manualLocalFormat(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
  );
}

const SNAPSHOTS = [

  [1700000000000, '2023-11-15 06:13:20'],
  [946684800000, '2000-01-01 08:00:00'],
  [4102444800000, '2100-01-01 08:00:00'],
  [1735660800000, '2025-01-01 00:00:00'],
];

describe('formatDateTime（等价 moment YYYY-MM-DD HH:mm:ss）', () => {
  it.each(SNAPSHOTS)('时间戳 %i 格式化一致', (ms, expected) => {
    expect(formatDateTime(ms)).toBe(manualLocalFormat(ms));
    if (TZ_IS_CN) {
      expect(formatDateTime(ms)).toBe(expected);
    }
  });

  it('falsy 输入返回占位符（0 同样返回占位，等价原 !d 分支）', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime(0)).toBe('');
    expect(formatDateTime(0, '-')).toBe('-');
    expect(formatDateTime('', 'N/A')).toBe('N/A');
  });

  it('无效日期返回 Invalid date（moment 字面）', () => {
    expect(formatDateTime('not-a-date')).toBe('Invalid date');
    expect(formatDateTime(new Date('xx'))).toBe('Invalid date');
  });
});

describe('listFilter（等价 list-filter 语义）', () => {
  const arr = [
    { id: 'abc' },
    { id: 'ABC' },
    { id: 'xabcx' },
    { name: 'zzz' },
  ];

  it('字符串键：子串匹配且大小写敏感', () => {
    expect(listFilter(arr, 'id', 'abc').map((n) => n.id)).toEqual(['abc', 'xabcx']);
    expect(listFilter(arr, 'id', 'ABC').map((n) => n.id)).toEqual(['ABC']);
  });

  it('函数键：以返回值匹配', () => {
    expect(listFilter(arr, (n) => n.id || n.name, 'zzz').length).toBe(1);
  });

  it('空 value 返回原数组；空数组返回 []', () => {
    expect(listFilter(arr, 'id', '')).toBe(arr);
    expect(listFilter(arr, 'id', undefined)).toBe(arr);
    expect(listFilter([], 'id', 'abc')).toEqual([]);
  });

  it('缺字段项不参与匹配', () => {
    expect(listFilter(arr, 'id', 'zzz')).toEqual([]);
  });
});

describe('sizeFormat（等价 sizeFormat filter）', () => {
  it('边界：0 与空值', () => {
    expect(sizeFormat(0)).toBe(0);
    expect(sizeFormat(undefined)).toBe('0');
    expect(sizeFormat(null)).toBe('0');
  });

  it('非 ex 模式：单段带两位小数', () => {
    expect(sizeFormat(1024)).toBe('1KB');
    expect(sizeFormat(1536)).toBe('1.5KB');
    expect(sizeFormat(pow2(2))).toBe('1MB');
    expect(sizeFormat(pow2(3))).toBe('1GB');
    expect(sizeFormat(512)).toBe('512B');
  });

  it('ex 模式：分段拼接', () => {
    expect(sizeFormat(pow2(3) + pow2(2) * 5 + 1024 * 3 + 7, true)).toBe('1G5M3K7B');
    expect(sizeFormat(pow2(2) * 2, true)).toBe('2M');
  });

  it('1023B 不升 KB', () => {
    expect(sizeFormat(1023)).toBe('1023B');
    expect(sizeFormat(1023, true)).toBe('1023B');
  });
});

function pow2(n) {
  return Math.pow(1024, n);
}

describe('settings store（等价 settingsSvs 键名/默认值/类型）', () => {
  beforeEach(() => {
    localStorage.clear();
    SecureStore.resetDekCache();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('默认值与 settingsSvs 一致', () => {
    const s = useSettingsStore();
    expect(s.autoUpgrade).toBe(1);
    expect(s.isCame).toBe(0);
    expect(s.maxUploadJobCount).toBe(3);
    expect(s.maxDownloadJobCount).toBe(1);
    expect(s.showImageSnapshot).toBe(1);
    expect(s.historiesLength).toBe(100);
    expect(s.logFile).toBe(0);
    expect(s.logFileInfo).toBe(0);
    expect(s.getRequestPayStatus).toBe('NO');
    expect(s.connectTimeout).toBe(60000);
    expect(s.uploadPartSize).toBe(10);
    expect(s.downloadConcurrecyPartSize).toBe(5);
    expect(s.listObjectNum).toBe(500);
    expect(s.uploadAndDownloadRetryTimes).toBe(5);
    expect(s.mailSmtp).toEqual({ port: 465 });
  });

  it('set 写 localStorage 且值类型为整数', () => {
    const s = useSettingsStore();
    s.set('maxUploadJobCount', 5);
    expect(localStorage.getItem('maxUploadJobCount')).toBe('5');
    expect(s.maxUploadJobCount).toBe(5);
    s.set('getRequestPayStatus', 'YES');
    expect(localStorage.getItem('getRequestPayStatus')).toBe('YES');
  });

  it('debouncedSet 500ms 防抖仅最后一次生效', () => {
    vi.useFakeTimers();
    const s = useSettingsStore();
    s.debouncedSet('listObjectNum', 100);
    s.debouncedSet('listObjectNum', 200);
    s.debouncedSet('listObjectNum', 300);
    expect(localStorage.getItem('listObjectNum')).toBe(null);

    vi.advanceTimersByTime(500);
    expect(localStorage.getItem('listObjectNum')).toBe('300');
    expect(s.listObjectNum).toBe(300);
  });

  it('mailSmtp 经 SecureStore 整体密文写入且回读一致', () => {
    globalThis.__testSafeStorage = true;
    const s = useSettingsStore();
    s.set('mailSmtp', { host: 'smtp.x.com', port: 465, secure: true, from: 'a@x.com', auth: { user: 'u', pass: 'p' } });

    const raw = localStorage.getItem('mailSender');
    expect(raw.indexOf('enc:v2:')).toBe(0);
    expect(raw.indexOf('smtp.x.com')).toBe(-1);
    expect(s.mailSmtp.auth.pass).toBe('p');
    expect(SecureStore.get('mailSender', null, { legacyPlain: true })).toContain('smtp.x.com');
  });

  it('mailSender 损坏值回退默认对象（D-11）', () => {
    localStorage.setItem('mailSender', 'not-json{');
    const s = useSettingsStore();
    expect(s.mailSmtp).toEqual({ port: 465 });
  });
});