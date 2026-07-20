import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/systems' },
    { path: '/systems', component: () => import('./views/SystemView.vue') },
    { path: '/servers', component: () => import('./views/ServerView.vue') },
    { path: '/middlewares', component: () => import('./views/MiddlewareView.vue') },
    { path: '/configs', component: () => import('./views/ConfigView.vue') },
    { path: '/tags', component: () => import('./views/TagView.vue') },
    { path: '/import-export', component: () => import('./views/ImportExportView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
    { path: '/onboarding', component: () => import('./views/OnboardingView.vue') },
  ],
});

export default router;
