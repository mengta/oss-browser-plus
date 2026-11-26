import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { signatureUrl2 } = vi.hoisted(() => ({ signatureUrl2: vi.fn() }));

vi.mock('@renderer/services/oss-client.js', () => ({
  ossClient: { signatureUrl2 },
}));

import CardThumb from '@renderer/components/base/CardThumb.vue';

describe('CardThumb：图片缩略图', () => {
  beforeEach(() => {
    signatureUrl2.mockReset();
  });

  it('图片对象申请 64x64 签名 URL 并渲染缩略图', async () => {
    signatureUrl2.mockResolvedValue('https://b.oss-cn-hangzhou.aliyuncs.com/pre/a.png?x-oss-process=image%2Fresize');
    const wrapper = mount(CardThumb, {
      props: {
        region: 'oss-cn-hangzhou',
        bucket: 'b',
        item: { name: 'a.png', path: 'pre/a.png', type: 'image/png' },
      },
    });
    await flushPromises();

    expect(signatureUrl2).toHaveBeenCalledWith(
      'oss-cn-hangzhou',
      'b',
      'pre/a.png',
      900,
      'image/resize,m_fill,w_64,h_64'
    );
    const img = wrapper.find('[data-testid="card-thumb-img"]');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toContain('x-oss-process');
    wrapper.unmount();
  });

  it('签名失败时回退占位图标', async () => {
    signatureUrl2.mockRejectedValue(new Error('denied'));
    const wrapper = mount(CardThumb, {
      props: {
        region: 'oss-cn-hangzhou',
        bucket: 'b',
        item: { name: 'a.png', path: 'pre/a.png', type: 'image/png' },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="card-thumb-img"]').exists()).toBe(false);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});