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
      return state.cameras.filter(cam => !cam.hidden && cam.enabled);
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
          // Mettre à jour les statuts des caméras
          this.cameras = this.cameras.map(camera => {
            const status = result.status.find(s => s.optionValue === camera.optionValue);
            return status ? { ...camera, ...status } : camera;
          });
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
