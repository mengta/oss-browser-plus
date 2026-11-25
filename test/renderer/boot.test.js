import { describe, it, expect } from 'vitest';
import { bootstrapFixture } from './fixtures/bootstrap.js';
import { i18nFixture } from './fixtures/i18n.js';
import { filesFixture } from './fixtures/files.js';

describe('renderer test harness', () => {
  it('exposes bootstrap fixture through window.ossBrowser', () => {
    const boot = window.ossBrowser.bootstrap.get();
    expect(boot.ok).toBe(true);
    expect(boot.data.appVersion).toBe(bootstrapFixture.appVersion);
    expect(Object.keys(boot.data.locales)).toEqual(['zh-CN', 'en-US', 'ja-JP']);
    expect(boot.data.locales['zh-CN'].label).toBe(i18nFixture['zh-CN'].label);
  });

  it('provides no-credential oss/tasks fixtures', async () => {
    const buckets = await window.ossBrowser.oss.listAllBuckets({});
    expect(buckets.ok).toBe(true);
    expect(buckets.data[0].name).toBe(filesFixture.buckets[0].name);

    const tasks = await window.ossBrowser.transfer.getTasks();
    expect(tasks.ok).toBe(true);
    expect(Array.isArray(tasks.data)).toBe(true);
  });

  it('installs DOM shims (ResizeObserver/matchMedia)', () => {
    expect(typeof window.ResizeObserver).toBe('function');
    expect(typeof window.matchMedia).toBe('function');
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false);
  });
});