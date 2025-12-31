import { defineStore } from 'pinia';
import BlueIrisAPI from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    session: null,
    user: null,
    server: {
      username: localStorage.getItem('username') || '',
      password: ''
    },
    apiClient: null,
    rememberMe: localStorage.getItem('remember_me') === 'true'
  }),

  getters: {
    baseURL: () => {
      // L'URL est maintenant gérée par le proxy Vite
      // Pas besoin de construire l'URL manuellement
      return '';
    }
  },

  actions: {
    async login(credentials) {
      try {
        const { username, password, rememberMe } = credentials;
        
        console.log('🚀 Démarrage du processus de connexion...', { username });
        
        // Le proxy Vite gère l'URL du serveur Blue Iris
        this.apiClient = new BlueIrisAPI('', username, password);
        
        console.log('📡 Client API créé, appel de login...');
        const result = await this.apiClient.login();
        
        console.log('📥 Résultat de login:', result);
        
        if (result.success) {
          this.isAuthenticated = true;
          this.session = result.session;
          this.user = {
            username: username,
            admin: result.data?.admin || false
          };
          
          this.server = { username, password: rememberMe ? password : '' };
          
          // Sauvegarder si "se souvenir"
          if (rememberMe) {
            localStorage.setItem('username', username);
            localStorage.setItem('password', btoa(password)); // Encoder en base64
            localStorage.setItem('remember_me', 'true');
          } else {
            localStorage.removeItem('username');
            localStorage.removeItem('password');
            localStorage.removeItem('remember_me');
          }
          
          return { success: true };
        }
        
        return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async logout() {
      if (this.apiClient) {
        await this.apiClient.logout();
      }
      
      this.isAuthenticated = false;
      this.session = null;
      this.user = null;
      this.apiClient = null;
    },

    updateRememberMe(value) {
      this.rememberMe = value;
      if (value) {
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('remember_me');
      }
    }
  }
});
