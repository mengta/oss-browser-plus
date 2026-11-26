import { createApp } from 'vue';
import App from './App.vue';
import { createRendererRouter } from './router/index.js';
import { createRendererStore } from './stores/index.js';
import { bindI18n, createRendererI18n, readStoredLocale } from './i18n/index.js';
import { snapshot } from './bootstrap.js';
import { useAuthStore } from './stores/auth.js';
import { reportError } from './services/renderer-log.js';
import { warmup as warmupSecureStore } from './services/secure-store.js';

const locale = readStoredLocale();

export function createRendererApp() {
  const app = createApp(App);
  const router = createRendererRouter();
  const store = createRendererStore();
  const i18n = createRendererI18n(locale);
  bindI18n(i18n);

  app.use(router);
  app.use(store);
  app.use(i18n);

  app.config.errorHandler = (err, instance, info) => {
    // P4（R-P4-05）：渲染层错误经 IPC 上报主进程（限流 + 脱敏落盘）
    reportError('vue-error', err, info);
    console.error('[renderer] vue error:', err, info);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      reportError('unhandled-rejection', event && event.reason);
      console.error('[renderer] unhandled rejection:', event.reason);
    });
    window.addEventListener('error', (event) => {
      reportError('window-error', event && event.error, event && event.message);
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

  router.isReady().then(async () => {
    // P3（R-P3-07）：在挂载前异步预热凭证服务（避免首屏同步凭证 IPC 阻塞）
    try {
      await warmupSecureStore();
    } catch (err) {
      reportError('secure-store-warmup', err);
    }
    app.mount(mountEl);
  });
}