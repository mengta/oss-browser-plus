import { describe, it, expect } from 'vitest';
import { ossClient } from '@renderer/services/oss-client.js';

// net-bridge 会把 preload 结果统一包成 { ok, data }，此处模拟真实桥接形态
function setProbe(fn) {
  window.ossBrowser.oss.probeUrl = fn;
}

describe('ossClient.probeUrl：外网地址探测参数', () => {
  it('直接传 target/opts，不注入 OSS 凭证，并透传桥接信封', async () => {
    let received = null;
    setProbe((...args) => {
      received = args;
      return Promise.resolve({ ok: true, data: { status: 200, ok: true, body: 'x' } });
    });

    const res = await ossClient.probeUrl('https://b.oss-cn-hangzhou.aliyuncs.com/a.txt');
    expect(received).toEqual(['https://b.oss-cn-hangzhou.aliyuncs.com/a.txt', {}]);
    expect(res).toEqual({ ok: true, data: { status: 200, ok: true, body: 'x' } });
  });

  it('403 结果仍在成功信封内，不被当作通道失败', async () => {
    setProbe(() => Promise.resolve({ ok: true, data: { status: 403, ok: false, body: 'denied' } }));
    await expect(ossClient.probeUrl('https://b.example.com/a.txt')).resolves.toEqual({
      ok: true,
      data: { status: 403, ok: false, body: 'denied' },
    });
  });

  it('通道失败返回 ok:false 信封，不 reject', async () => {
    setProbe(() => Promise.resolve({ ok: false, code: 'PROBE_FAILED', message: 'app:probe-url failed' }));
    await expect(ossClient.probeUrl('https://b.example.com/a.txt')).resolves.toMatchObject({
      ok: false,
      code: 'PROBE_FAILED',
    });
  });
});