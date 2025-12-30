import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    language: localStorage.getItem('locale') || 'auto',
    theme: localStorage.getItem('theme') || 'dark',
    videoQuality: localStorage.getItem('video_quality') || 'high',
    autoRefresh: localStorage.getItem('auto_refresh') === 'true',
    refreshInterval: parseInt(localStorage.getItem('refresh_interval') || '5000')
  }),

  actions: {
    setLanguage(lang) {
      this.language = lang;
      localStorage.setItem('locale', lang);
    },

    setTheme(theme) {
      this.theme = theme;
      localStorage.setItem('theme', theme);
      
      // Appliquer le thème
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // Auto: détecter la préférence système
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },

    setVideoQuality(quality) {
      this.videoQuality = quality;
      localStorage.setItem('video_quality', quality);
    },

    setAutoRefresh(enabled) {
      this.autoRefresh = enabled;
      localStorage.setItem('auto_refresh', enabled.toString());
    },

    setRefreshInterval(interval) {
      this.refreshInterval = interval;
      localStorage.setItem('refresh_interval', interval.toString());
    },

    initTheme() {
      this.setTheme(this.theme);
    }
  }
});
