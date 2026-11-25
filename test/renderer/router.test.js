import { describe, it, expect } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { routes } from '@renderer/router/routes.js';

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes });
}

describe('renderer routes', () => {
  it('/login 解析为 login', async () => {
    const router = makeRouter();
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('/ 解析为 home', async () => {
    const router = makeRouter();
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('home');
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