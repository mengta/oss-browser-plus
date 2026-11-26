import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import QrCodeCard from '@renderer/components/base/QrCodeCard.vue';
import OssFileSelector from '@renderer/components/base/OssFileSelector.vue';
import AutoHeightBox from '@renderer/components/base/AutoHeightBox.vue';
import { createRendererI18n } from '@renderer/i18n/index.js';

// B3-13：二维码 / 对象选择器 / 自动高度基座契约

let calls = [];

function installOss(overrides) {
  calls = [];
  const oss = Object.assign(
    {
      listAllBuckets: () => Promise.resolve({ ok: true, data: [{ name: 'b1', region: 'r1' }] }),
      listAllFiles: (auth, region, bucket, key, folderOnly) => {
        calls.push(['listAllFiles', region, bucket, key, folderOnly]);
        const prefix = String(key || '');
        if (prefix === 'pre/') {
          return Promise.resolve({
            ok: true,
            data: [
              { name: 'sub', path: 'pre/sub/', isFolder: true },
              { name: 'a.txt', path: 'pre/a.txt', isFile: true },
            ],
          });
        }
        if (prefix === 'pre/sub/') {
          return Promise.resolve({
            ok: true,
            data: [{ name: 'inner.txt', path: 'pre/sub/inner.txt', isFile: true }],
          });
        }
        return Promise.resolve({ ok: true, data: [] });
      },
    },
    overrides || {}
  );
  window.ossBrowser = window.ossBrowser || {};
  window.ossBrowser.oss = oss;
}

function mountWith(component, props) {
  const pinia = getActivePinia() || createPinia();
  return mount(component, {
    props: props || {},
    global: { plugins: [pinia, createRendererI18n()] },
  });
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('QrCodeCard：矩阵/尺寸/纠错级别与 data URL', () => {
  it('空文本不渲染；有文本渲染 SVG 且尺寸与 props 一致', async () => {
    const empty = mountWith(QrCodeCard, { text: '' });
    await flushPromises();
    expect(empty.find('[data-testid="qrcode-svg"]').exists()).toBe(false);

    const wrapper = mountWith(QrCodeCard, { text: 'https://example.com/a?x=1', width: 300, height: 300 });
    await flushPromises();
    const svg = wrapper.find('[data-testid="qrcode-svg"]');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('width')).toBe('300');
    expect(svg.attributes('height')).toBe('300');
    expect(svg.attributes('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(wrapper.find('path').attributes('d').length).toBeGreaterThan(100);
  });

  it('同一内容矩阵稳定；toDataURL 输出 SVG Base64', async () => {
    const a = mountWith(QrCodeCard, { text: 'oss://b/pre/a.txt' });
    const b = mountWith(QrCodeCard, { text: 'oss://b/pre/a.txt' });
    await flushPromises();
    expect(a.find('path').attributes('d')).toBe(b.find('path').attributes('d'));

    const dataUrl = a.vm.toDataURL();
    expect(dataUrl.indexOf('data:image/svg+xml;base64,')).toBe(0);
    expect(dataUrl.length).toBeGreaterThan(200);
  });
});

describe('OssFileSelector：目录浏览与路径输出', () => {
  it('bucket 列表 → 进入 bucket → 目录内列表（folderOnly 参数）', async () => {
    installOss({});
    const selected = { ossPath: 'oss://', region: '' };
    const wrapper = mountWith(OssFileSelector, {
      config: { region: '', bucket: '', key: '' },
      selectedItem: selected,
      height: 220,
    });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="oss-selector-row"]').length).toBe(1);
    expect(wrapper.find('[data-testid="oss-selector-path"]').element.value).toBe('oss://');

    await wrapper.find('[data-testid="oss-selector-row"]').trigger('click');
    await flushPromises();
    expect(selected.ossPath).toBe('oss://b1/');

    await wrapper.setProps({ config: { region: 'r1', bucket: 'b1', key: 'pre/' } });
    await flushPromises();
    expect(calls[calls.length - 1]).toEqual(['listAllFiles', 'r1', 'b1', 'pre/', true]);
    expect(wrapper.findAll('[data-testid="oss-selector-row"]').length).toBe(2);
  });

  it('点击目录进入下一级；goUp 逐级回退', async () => {
    installOss({});
    const selected = { ossPath: 'oss://', region: '' };
    const wrapper = mountWith(OssFileSelector, {
      config: { region: 'r1', bucket: 'b1', key: 'pre/' },
      selectedItem: selected,
      height: 220,
    });
    await flushPromises();

    await wrapper.findAll('[data-testid="oss-selector-row"]')[0].trigger('click');
    await flushPromises();
    expect(calls[calls.length - 1]).toEqual(['listAllFiles', 'r1', 'b1', 'pre/sub/', true]);
    expect(selected.ossPath).toBe('oss://b1/pre/sub/');

    await wrapper.find('[data-testid="oss-selector-up"]').trigger('click');
    await flushPromises();
    expect(calls[calls.length - 1]).toEqual(['listAllFiles', 'r1', 'b1', 'pre/', true]);
  });
});

describe('AutoHeightBox：-130 偏移与 resize 重算', () => {
  const originalHeight = window.innerHeight;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
  });

  function setInnerHeight(value) {
    Object.defineProperty(window, 'innerHeight', { value: value, configurable: true });
  }

  it('挂载即按 innerHeight+offset 设置高度；resize 300ms 防抖重算', async () => {
    setInnerHeight(800);
    const wrapper = mountWith(AutoHeightBox, { offset: -130 });
    await flushPromises();
    const el = wrapper.find('[data-testid="auto-height-box"]').element;
    expect(el.style.height).toBe('670px');

    setInnerHeight(1000);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(299);
    expect(el.style.height).toBe('670px');
    vi.advanceTimersByTime(1);
    expect(el.style.height).toBe('870px');

    wrapper.unmount();
  });
});