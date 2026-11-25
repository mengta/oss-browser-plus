import LoginPage from '../pages/LoginPage.vue';
import FilesPage from '../pages/FilesPage.vue';

export const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
  },
  {
    // B3-02：'/' 由占位换成 FilesPage（B1-07 预留）；过渡期 route-arbiter 仍控制
    // 仅 '#/vue/' hash 显示 Vue 壳，默认 hash 下 Angular files 页不受影响（B3-19 收口）
    path: '/',
    name: 'files',
    component: FilesPage,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];