import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/live'
  },
  {
    path: '/live',
    name: 'Live',
    component: () => import('../views/LiveView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/clips',
    name: 'Clips',
    component: () => import('../views/ClipsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/timeline',
    name: 'Timeline',
    component: () => import('../views/TimelineView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login.htm',
    redirect: (to) => {
      // Blue Iris redirige vers /login.htm?page=/timeline ou /clips quand la session expire
      // Extraire le paramètre 'page' et rediriger vers la bonne route Vue
      const targetPage = to.query.page;
      if (targetPage) {
        console.log('🔀 Redirecting from /login.htm to:', targetPage);
        // Rediriger vers la page demandée sans conserver les query params
        return { path: targetPage, query: {} };
      } else {
        // Par défaut, aller au login
        console.log('🔀 No page param, redirecting to /login');
        return '/login';
      }
    }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Sauvegarder la route de destination pour y retourner après login
    next({ 
      name: 'Login',
      query: { redirect: to.fullPath }
    });
  } else if (to.name === 'Login' && authStore.isAuthenticated) {
    // Si déjà authentifié et on va vers Login, rediriger vers la page demandée ou Live
    const redirectPath = to.query.redirect || '/live';
    next(redirectPath);
  } else {
    next();
  }
});

export default router;
