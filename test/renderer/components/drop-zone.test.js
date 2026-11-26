import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DropZone from '@renderer/components/base/DropZone.vue';

function mountZone() {
  return mount(DropZone, { global: { stubs: { transition: false } } });
}

describe('DropZone：拖拽取路径', () => {
  it('getPathForFile 返回 { ok, data } 时取 data 作为路径', async () => {
    window.ossBrowser.system.getPathForFile = () => ({ ok: true, data: 'C:/tmp/a.txt' });
    const wrapper = mountZone();

    await wrapper.find('[data-testid="drop-zone"]').trigger('drop', {
      dataTransfer: { files: [{ name: 'a.txt' }] },
    });

    expect(wrapper.emitted('dropped').slice(-1)[0][0]).toEqual(['C:/tmp/a.txt']);
    wrapper.unmount();
  });

  it('桥接失败时回退 File.path（Electron < 32）', async () => {
    window.ossBrowser.system.getPathForFile = () => ({ ok: false, code: 'INTERNAL', message: 'failed' });
    const wrapper = mountZone();

    await wrapper.find('[data-testid="drop-zone"]').trigger('drop', {
      dataTransfer: { files: [{ name: 'b.txt', path: 'D:/tmp/b.txt' }] },
    });

    expect(wrapper.emitted('dropped').slice(-1)[0][0]).toEqual(['D:/tmp/b.txt']);
    wrapper.unmount();
  });
});