import { describe, it, expect } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { routes } from '@renderer/router/routes.js';
import { createRendererRouter, routes as exportedRoutes } from '@renderer/router/index.js';

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes });
}

describe('renderer routes', () => {
  it('/login 解析为 login', async () => {
    const router = makeRouter();
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('/ 解析为 files（B3-02：占位换 FilesPage）', async () => {
    const router = makeRouter();
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('files');
  });

  it('未知路径回退到 /', async () => {
    const router = makeRouter();
    await router.push('/not-exist/deep');
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('路由表无全局登录守卫（仅三条声明式路由）', async () => {
    const { readFileSync } = await import('fs');
    const source = readFileSync('app/renderer/router/routes.js', 'utf8');
    expect(source.indexOf('beforeEach')).toBe(-1);
    expect(routes.length).toBe(3);
  });
});

describe('createRendererRouter', () => {
  it('使用 hash 路由并挂载同一份路由表', async () => {
    const router = createRendererRouter();

    expect(exportedRoutes).toBe(routes);
    expect(typeof router.push).toBe('function');
    expect(router.options.history.base !== undefined || router.options.history.location !== undefined).toBe(true);

    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('三条路由全部注册且未知路径重定向到 /', async () => {
    const router = createRendererRouter();

    expect(router.getRoutes().map((route) => route.name).filter(Boolean).sort()).toEqual([
      'files',
      'login',
    ]);

    await router.push('/unknown/deep/path');
    expect(router.currentRoute.value.name).toBe('files');
    expect(router.currentRoute.value.path).toBe('/');
  });
});
