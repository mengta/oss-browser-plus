import LoginPage from '../pages/LoginPage.vue';
import HomePage from '../pages/HomePage.vue';

export const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
  },
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];