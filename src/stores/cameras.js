import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

export const useCamerasStore = defineStore('cameras', {
  state: () => ({
    cameras: [],
    selectedCamera: null,
    loading: false,
    error: null,
    updateInterval: null
  }),

  getters: {
    activeCameras: (state) => {
      // Les caméras avec optionValue commençant par + ou @ sont des groupes
      // Filtrer les caméras individuelles qui sont actives
      return state.cameras.filter(cam => 
        !cam.optionValue?.startsWith('+') && 
        !cam.optionValue?.startsWith('@') &&
        !cam.hidden && 
        cam.isEnabled !== false
      );
    },
    
    cameraById: (state) => {
      return (id) => state.cameras.find(cam => cam.optionValue === id);
    },

    hasPTZ: (state) => {
      if (!state.selectedCamera) return false;
      const camera = state.cameras.find(cam => cam.optionValue === state.selectedCamera);
      return camera?.ptz || false;
    }
  },

  actions: {
    async fetchCameras() {
      const authStore = useAuthStore();
      
      if (!authStore.apiClient) {
        this.error = 'Not authenticated';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const result = await authStore.apiClient.getCameras();
        
        if (result.success) {
          this.cameras = result.cameras || [];
        } else {
          this.error = result.error;
        }
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async fetchStatus() {
      const authStore = useAuthStore();
      
      if (!authStore.apiClient) return;

      try {
        const result = await authStore.apiClient.getStatus();
        
        if (result.success && result.status) {
          // Blue Iris retourne un objet avec des propriétés de caméra, pas un tableau
          // On va juste ignorer cette mise à jour pour l'instant
          console.log('Status update:', result.status);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    },

    selectCamera(cameraId) {
      this.selectedCamera = cameraId;
    },

    clearSelection() {
      this.selectedCamera = null;
    },

    startAutoUpdate(interval = 5000) {
      this.stopAutoUpdate();
      this.updateInterval = setInterval(() => {
        this.fetchStatus();
      }, interval);
    },

    stopAutoUpdate() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    },

    async ptzCommand(command, params = {}) {
      const authStore = useAuthStore();
      
      if (!this.selectedCamera || !authStore.apiClient) {
        return { success: false, error: 'No camera selected' };
      }

      return await authStore.apiClient.ptzCommand(this.selectedCamera, command, params);
    },

    async triggerCamera(cameraId) {
      const authStore = useAuthStore();
      
      if (!authStore.apiClient) {
        return { success: false, error: 'Not authenticated' };
      }

      return await authStore.apiClient.triggerCamera(cameraId);
    },

    getStreamURL(cameraId, quality = 'high') {
      const authStore = useAuthStore();
      
      if (!authStore.apiClient) return '';
      
      return authStore.apiClient.getStreamURL(cameraId, quality);
    },

    getSnapshotURL(cameraId, width = 640, height = 480) {
      const authStore = useAuthStore();
      
      if (!authStore.apiClient) return '';
      
      return authStore.apiClient.getSnapshotURL(cameraId, width, height);
    }
  }
});
