<template>
  <div class="login-view">
    <div class="login-container">
      <div class="logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h1>Blue Iris</h1>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>{{ t('login.username') }}</label>
          <input
            v-model="form.username"
            type="text"
            class="input"
            :placeholder="t('login.username')"
            required
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label>{{ t('login.password') }}</label>
          <input
            v-model="form.password"
            type="password"
            class="input"
            :placeholder="t('login.password')"
            required
          />
        </div>

        <div class="form-checkbox">
          <input
            v-model="form.rememberMe"
            type="checkbox"
            id="remember"
          />
          <label for="remember">{{ t('login.remember') }}</label>
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? t('login.connecting') : t('login.signin') }}
        </button>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = ref({
  username: '',
  password: '',
  rememberMe: false
});

const loading = ref(false);
const error = ref('');

onMounted(async () => {
  // Charger les valeurs sauvegardées
  const savedPassword = localStorage.getItem('password');
  const rememberMe = authStore.rememberMe;
  
  form.value = {
    username: authStore.server.username || '',
    password: savedPassword && rememberMe ? atob(savedPassword) : '',
    rememberMe: rememberMe
  };
  
  // Connexion automatique si "se souvenir" est activé et qu'on a les informations
  if (rememberMe && form.value.username && form.value.password) {
    console.log('🔐 Connexion automatique...');
    await handleLogin();
  }
});

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  const result = await authStore.login(form.value);

  if (result.success) {
    // Rediriger vers la page demandée ou /live par défaut
    const redirectPath = route.query.redirect || '/live';
    console.log('🔐 Login successful, redirecting to:', redirectPath);
    router.push(redirectPath);
  } else {
    error.value = result.error || t('login.error');
  }

  loading.value = false;
};
</script>

<style scoped>
.login-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--spacing-lg);
  background: linear-gradient(135deg, var(--color-background) 0%, var(--color-primary) 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-lg);
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.logo svg {
  width: 64px;
  height: 64px;
  color: var(--color-accent);
}

.logo h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.form-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-checkbox label {
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
}

.btn-block {
  width: 100%;
  padding: var(--spacing-md);
  font-size: 16px;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  padding: var(--spacing-md);
  background: rgba(233, 69, 96, 0.1);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: 14px;
  text-align: center;
}

@media (max-width: 480px) {
  .login-container {
    padding: var(--spacing-lg);
  }
  
  .logo h1 {
    font-size: 24px;
  }
}
</style>
