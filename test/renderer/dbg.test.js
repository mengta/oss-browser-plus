import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createRendererI18n } from '@renderer/i18n/index.js';
import AboutModal from '@renderer/components/business/modals/AboutModal.vue';
import * as SecureStore from '@renderer/services/secure-store.js';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('lang', 'zh-CN');
  SecureStore.resetDekCache();
  setActivePinia(createPinia());
  window.ossBrowser = {
    bootstrap: { get: () => ({ ok: true, data: { appVersion: '1.20.6', logo: 'icons/icon.png', aboutHtml: '', platform: 'win32', arch: 'x64', releaseNotesUrl: 'https://notes.example.com/release-notes/' } }) },
    system: { openExternal: () => {} },
    upgrade: { check: () => Promise.resolve({ ok: true, data: { version: '1.21.0', package_url: 'https://pkg.example.com' } }), subscribe: () => 's1' },
  };
});

describe('dbg5', () => {
  it('openExternal path', async () => {
    const opened = [];
    window.ossBrowser.system = { openExternal: (url) => opened.push(url) };
    const wrapper = mount(AboutModal, { global: { plugins: [getActivePinia(), createRendererI18n('zh-CN')] } });
    await nextTick();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await nextTick();
    const dl = wrapper.find('[data-testid="about-download"]');
    console.log('download exists=', dl.exists());
    await dl.trigger('click');
    for (let i = 0; i < 20; i++) await Promise.resolve();
    console.log('opened=', JSON.stringify(opened));
    expect(true).toBe(true);
  });
});
