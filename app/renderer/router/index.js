import { createRouter, createWebHashHistory } from 'vue-router';
import { routes } from './routes.js';

export { routes };

export function createRendererRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes,
  });
}