import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 隔离上报通道：renderer-log 只依赖 api.system.reportError，
// 用模块 mock 才能精确验证聚合/降级语义（真实 api.js 会把异常归一成结果）。
const { channel } = vi.hoisted(() => ({ channel: { api: { system: { reportError: () => {} } } } }));

vi.mock('@renderer/services/api.js', () => channel);

let log;
let reportError;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  reportError = vi.fn();
  channel.api.system.reportError = reportError;
  log = await import('@renderer/services/renderer-log.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  channel.api.system = { reportError: () => {} };
});

describe('renderer-log 聚合上报', () => {
  it('1s 窗口内同类错误聚合成一条并带上计数', async () => {
    log.reportError('vue', new Error('boom'));
    log.reportError('vue', new Error('boom'));
    log.reportError('window', new Error('boom'));

    expect(reportError).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(reportError).toHaveBeenCalledTimes(2);
    const vueEntry = reportError.mock.calls.find((call) => call[0].kind === 'vue')[0];
    expect(vueEntry).toMatchObject({ kind: 'vue', message: 'boom', count: 2 });
    expect(vueEntry.stack).toContain('boom');
    expect(vueEntry.url).toContain('http');
    expect(log.reportedCount()).toBe(2);
  });

  it('不同窗口的错误分别上报', async () => {
    log.reportError('vue', new Error('first'));
    await vi.advanceTimersByTimeAsync(1000);
    log.reportError('vue', new Error('second'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(reportError).toHaveBeenCalledTimes(2);
    expect(reportError.mock.calls[0][0].message).toBe('first');
    expect(reportError.mock.calls[1][0].message).toBe('second');
    expect(reportError.mock.calls[0][0].count).toBe(1);
  });

  it('非 Error 入参回退到字符串或默认文案', async () => {
    log.reportError('manual', 'custom-message');
    log.reportError('manual2', undefined, { detail: 1 });
    log.reportError(undefined, null);
    await vi.advanceTimersByTimeAsync(1000);

    const messages = reportError.mock.calls.map((call) => call[0].message);
    expect(messages).toContain('custom-message');
    expect(messages).toContain('[object Object]');
    expect(messages).toContain('unknown error');
    expect(reportError.mock.calls[0][0].kind).toBe('manual');
  });

  it('超长堆栈截断到 4000 字符', async () => {
    const err = new Error('long');
    err.stack = 'x'.repeat(9000);

    log.reportError('vue', err);
    await vi.advanceTimersByTimeAsync(1000);

    expect(reportError.mock.calls[0][0].stack.length).toBe(4000);
  });

  it('上报函数抛错时降级为控制台输出且不中断后续上报', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportError
      .mockImplementationOnce(() => {
        throw new Error('ipc closed');
      })
      .mockImplementationOnce(() => {});

    log.reportError('vue', new Error('a'));
    log.reportError('window', new Error('b'));

    await vi.advanceTimersByTimeAsync(1000);
    expect(reportError).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[renderer-log] report failed:', 'ipc closed');
    expect(log.reportedCount()).toBe(1);
  });

  it('桥接缺少 reportError 时放弃上报且不累计计数', async () => {
    channel.api.system.reportError = undefined;

    log.reportError('vue', new Error('dropped'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(log.reportedCount()).toBe(0);

    // 缓冲已在 flush 时清空：恢复通道后只会收到新错误
    reportError = vi.fn();
    channel.api.system.reportError = reportError;
    log.reportError('vue', new Error('after-reset'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][0].message).toBe('after-reset');
    expect(log.reportedCount()).toBe(1);
  });

  it('api.system 整体缺失时静默返回', async () => {
    channel.api.system = undefined;

    log.reportError('vue', new Error('no-channel'));

    await vi.advanceTimersByTimeAsync(1000);
    expect(log.reportedCount()).toBe(0);

    channel.api.system = { reportError };
  });
});