import { createApp } from 'vue';
import App from './App.vue';
import { createRendererRouter } from './router/index.js';
import { createRendererStore } from './stores/index.js';
import { createRendererI18n, readStoredLocale } from './i18n/index.js';
import { snapshot } from './bootstrap.js';
import { useAuthStore } from './stores/auth.js';

const locale = readStoredLocale();

export function createRendererApp() {
  const app = createApp(App);
  const router = createRendererRouter();
  const store = createRendererStore();
  const i18n = createRendererI18n(locale);

  app.use(router);
  app.use(store);
  app.use(i18n);

  app.config.errorHandler = (err, instance, info) => {
    console.error('[renderer] vue error:', err, info);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[renderer] unhandled rejection:', event.reason);
    });
  }

  return { app, router, store, i18n, snapshot };
}

const mountEl = document.getElementById('vue-app');
if (mountEl) {
  const { app, router, store, snapshot } = createRendererApp();
  if (document.title === 'OSS Browser' && snapshot && snapshot.appTitle) {
    document.title = snapshot.appTitle;
  }

  // 未登录时初始化到 /login；已登录保持 /（Vue 文件页）。
  const auth = useAuthStore(store);
  auth.load();
  if (!auth.isLoggedIn) {
    router.replace('/login').catch(() => {});
  }

  router.isReady().then(() => {
    app.mount(mountEl);
  });
}