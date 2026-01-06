import { ref } from 'vue';

// État partagé pour le mode fullscreen
const fullscreenCamera = ref(null);

// État partagé pour le mode édition
const isEditMode = ref(false);

export function useFullscreen() {
  return {
    fullscreenCamera,
    isEditMode
  };
}
