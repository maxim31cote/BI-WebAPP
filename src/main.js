import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import './style.css';
import { registerSW } from 'virtual:pwa-register';

// Enregistrer le Service Worker pour la PWA
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('📦 Nouvelle version disponible');
    },
    onOfflineReady() {
      console.log('✅ Application prête en mode hors-ligne');
    },
  });
}

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

app.mount('#app');
