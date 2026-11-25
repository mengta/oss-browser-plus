export const bootstrapFixture = {
  appId: 'oss-browser',
  appVersion: '1.20.6',
  appTitle: 'OSS Browser',
  appName: { 'zh-CN': 'OSS浏览器', 'en-US': 'OSS Browser' },
  logo: 'icons/icon.png',
  aboutHtml: '',
  configPath: '/tmp/.oss-browser',
  releaseNotesUrl: 'https://example.com/release-notes/',
  upgradeUrl: 'https://example.com/upgrade.json',
  locales: {
    'zh-CN': { label: '简体中文', content: {} },
    'en-US': { label: 'English', content: {} },
    'ja-JP': { label: '日本語', content: {} },
  },
  platform: 'win32',
  arch: 'x64',
  isDev: false,
};

export function ok(data) {
  return { ok: true, data };
}

export function fail(code, message) {
  return { ok: false, code, message };
}