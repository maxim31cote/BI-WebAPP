import { defineStore } from 'pinia';
import BlueIrisAPI from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    session: null,
    user: null,
    server: {
      host: localStorage.getItem('server_host') || '',
      port: localStorage.getItem('server_port') || '81',
      username: localStorage.getItem('username') || '',
      password: ''
    },
    apiClient: null,
    rememberMe: localStorage.getItem('remember_me') === 'true'
  }),

  getters: {
    baseURL: (state) => {
      if (!state.server.host) return '';
      const protocol = window.location.protocol;
      return `${protocol}//${state.server.host}:${state.server.port}`;
    }
  },

  actions: {
    async login(credentials) {
      try {
        const { host, port, username, password, rememberMe } = credentials;
        
        const baseURL = `${window.location.protocol}//${host}:${port}`;
        this.apiClient = new BlueIrisAPI(baseURL, username, password);
        
        const result = await this.apiClient.login();
        
        if (result.success) {
          this.isAuthenticated = true;
          this.session = result.session;
          this.user = {
            username: username,
            admin: result.data?.admin || false
          };
          
          this.server = { host, port, username, password: '' };
          
          // Sauvegarder si "se souvenir"
          if (rememberMe) {
            localStorage.setItem('server_host', host);
            localStorage.setItem('server_port', port);
            localStorage.setItem('username', username);
            localStorage.setItem('remember_me', 'true');
          } else {
            localStorage.removeItem('server_host');
            localStorage.removeItem('server_port');
            localStorage.removeItem('username');
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
