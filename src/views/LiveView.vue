<template>
  <div class="live-view">
    <!-- Header avec server info -->
    <div class="header">
      <h1>{{ t('live.title') }}</h1>
      <div class="server-info" v-if="serverStatus">
        <div class="info-item">
          <span class="label">{{ t('server.cpu') }}</span>
          <span class="value" :class="getStatusClass(serverStatus.cpu)">
            {{ serverStatus.cpu }}%
          </span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('server.memory') }}</span>
          <span class="value" :class="getStatusClass(serverStatus.mem)">
            {{ serverStatus.mem }}%
          </span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('server.fps') }}</span>
          <span class="value">{{ serverStatus.fps }}</span>
        </div>
      </div>
    </div>

    <!-- Grille de caméras -->
    <div class="camera-container">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="loadCameras" class="btn btn-primary">
          {{ t('common.retry') }}
        </button>
      </div>

      <div v-else-if="!selectedCamera" class="camera-grid">
        <div
          v-for="camera in activeCameras"
          :key="camera.optionValue"
          @click="selectCamera(camera)"
          class="camera-tile"
        >
          <img
            :src="getSnapshotURL(camera.optionValue)"
            :alt="camera.optionDisplay"
            @error="handleImageError"
          />
          <div class="camera-overlay">
            <span class="camera-name">{{ camera.optionDisplay }}</span>
            <div class="camera-status">
              <span v-if="camera.isRecording" class="status-badge recording">
                ● {{ t('live.recording') }}
              </span>
              <span v-if="camera.isTriggered" class="status-badge triggered">
                ⚠ {{ t('live.triggered') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Vue caméra unique -->
      <div v-else class="single-camera-view">
        <button @click="clearSelection" class="btn-back">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <video 
          ref="videoPlayer" 
          class="video-player"
          autoplay
          playsinline
          muted
          controls
        ></video>

        <div class="camera-info">
          <h2>{{ selectedCameraData?.optionDisplay }}</h2>
        </div>

        <!-- Contrôles PTZ -->
        <div v-if="hasPTZ" class="ptz-controls">
          <button @click="togglePTZ" class="btn-ptz-toggle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </button>

          <div v-show="showPTZ" class="ptz-overlay">
            <div class="ptz-dpad">
              <button @click="ptz('up')" class="ptz-btn ptz-up">▲</button>
              <button @click="ptz('left')" class="ptz-btn ptz-left">◄</button>
              <button @click="ptz('home')" class="ptz-btn ptz-center">⌂</button>
              <button @click="ptz('right')" class="ptz-btn ptz-right">►</button>
              <button @click="ptz('down')" class="ptz-btn ptz-down">▼</button>
            </div>
            <div class="ptz-zoom">
              <button @click="ptz('zoomin')" class="ptz-btn">+</button>
              <button @click="ptz('zoomout')" class="ptz-btn">−</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watchEffect, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCamerasStore } from '../stores/cameras';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import JMuxer from 'jmuxer';

const { t } = useI18n();
const camerasStore = useCamerasStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const loading = ref(false);
const error = ref('');
const showPTZ = ref(false);
const videoPlayer = ref(null);
const jmuxer = ref(null);
const serverStatus = ref(null);
const statusInterval = ref(null);

const activeCameras = computed(() => camerasStore.activeCameras);
const selectedCamera = computed(() => camerasStore.selectedCamera);
const hasPTZ = computed(() => camerasStore.hasPTZ);

const selectedCameraData = computed(() => {
  if (!selectedCamera.value) return null;
  return camerasStore.cameraById(selectedCamera.value);
});

const loadCameras = async () => {
  loading.value = true;
  error.value = '';
  await camerasStore.fetchCameras();
  if (camerasStore.error) {
    error.value = camerasStore.error;
  }
  loading.value = false;
};

const selectCamera = (camera) => {
  camerasStore.selectCamera(camera.optionValue);
};

const clearSelection = () => {
  if (jmuxer.value) {
    jmuxer.value.destroy();
    jmuxer.value = null;
  }
  if (videoPlayer.value) {
    videoPlayer.value.pause();
    videoPlayer.value.src = '';
  }
  camerasStore.clearSelection();
};

const togglePTZ = () => {
  showPTZ.value = !showPTZ.value;
};

const ptz = async (command) => {
  await camerasStore.ptzCommand(command);
};

const getSnapshotURL = (cameraId) => {
  return camerasStore.getSnapshotURL(cameraId, 320, 240);
};

const handleImageError = (e) => {
  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"%3E%3Crect fill="%23333" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" fill="%23666" font-family="Arial" font-size="14" text-anchor="middle" dominant-baseline="middle"%3EOffline%3C/text%3E%3C/svg%3E';
};

const getStatusClass = (value) => {
  if (value < 60) return 'good';
  if (value < 80) return 'warning';
  return 'critical';
};

const updateServerStatus = async () => {
  const result = await authStore.apiClient.getStatus();
  if (result.success && result.status) {
    serverStatus.value = {
      cpu: result.status.cpu || 0,
      mem: result.status.mem || 0,
      fps: result.status.fps || 0
    };
  }
};

// Initialiser jmuxer pour Blue Iris MPEG streaming avec MSE
watchEffect((onCleanup) => {
  // Capturer les valeurs immédiatement pour éviter les re-déclenchements
  const camera = selectedCamera.value;
  const player = videoPlayer.value;
  
  console.log('📹 WatchEffect triggered:', { camera, hasPlayer: !!player });
  
  if (!camera || !player) {
    console.log('⚠️ Missing camera or player, skipping');
    return;
  }
  
  // Utiliser les valeurs capturées, pas les refs
  (async () => {
    const streamURL = camerasStore.getStreamURL(camera, settingsStore.videoQuality);
    console.log('🎥 Stream URL:', streamURL);
    
    // Détruire l'instance jmuxer précédente
    if (jmuxer.value) {
      jmuxer.value.destroy();
      jmuxer.value = null;
    }
    
    console.log('✨ Creating JMuxer instance');
    
    loading.value = true;
    
    // Initialiser JMuxer avec configuration Blue Iris
    jmuxer.value = new JMuxer({
      node: player,
      mode: 'video',
      flushingTime: 500,
      fps: 30,
      debug: false
    });
    
    // Streamer les données MPEG via fetch
    console.log('📡 Starting MPEG stream fetch');
    
    const controller = new AbortController();
    
    // Cleanup sur changement de caméra
    onCleanup(() => {
      console.log('🧹 Cleaning up stream');
      controller.abort();
    });
    
    try {
      const response = await fetch(streamURL, {
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log('✅ Stream connected');
      
      const reader = response.body.getReader();
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream ended');
          break;
        }
        
        chunkCount++;
        
        // Envoyer les chunks MPEG bruts à jmuxer
        if (jmuxer.value && value && value.byteLength > 0) {
          jmuxer.value.feed({
            video: value  // value est déjà un Uint8Array
          });
          
          // Cacher le loading après le premier chunk valide
          if (chunkCount === 1) {
            console.log(`✅ First chunk received: ${value.byteLength} bytes`);
            loading.value = false;
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Stream error:', err);
      }
    }
  })(); // Exécuter la fonction async immédiatement
});

onMounted(async () => {
  await loadCameras();
  camerasStore.startAutoUpdate();
  
  // Mettre à jour le status du serveur
  updateServerStatus();
  statusInterval.value = setInterval(updateServerStatus, 2000);
});

onUnmounted(() => {
  camerasStore.stopAutoUpdate();
  
  if (jmuxer.value) {
    jmuxer.value.destroy();
    jmuxer.value = null;
  }
  
  if (statusInterval.value) {
    clearInterval(statusInterval.value);
  }
});
</script>

<style scoped>
.live-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 70px);
  overflow: hidden;
}

.header {
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header h1 {
  font-size: 20px;
  margin-bottom: var(--spacing-sm);
}

.server-info {
  display: flex;
  gap: var(--spacing-md);
  font-size: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-item .label {
  color: var(--color-text-secondary);
}

.info-item .value {
  font-weight: 600;
}

.info-item .value.good { color: var(--color-success); }
.info-item .value.warning { color: var(--color-warning); }
.info-item .value.critical { color: var(--color-error); }

.camera-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.camera-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.camera-tile {
  position: relative;
  aspect-ratio: 4/3;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.camera-tile:active {
  transform: scale(0.98);
}

.camera-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-sm);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  color: white;
}

.camera-name {
  font-size: 14px;
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
}

.camera-status {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
}

.status-badge.recording {
  background: var(--color-error);
}

.status-badge.triggered {
  background: var(--color-warning);
}

.single-camera-view {
  position: relative;
  height: 100%;
  background: black;
}

.btn-back {
  position: absolute;
  top: var(--spacing-md);
  left: var(--spacing-md);
  z-index: 10;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-back svg {
  width: 24px;
  height: 24px;
}

.video-player {
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
}

.camera-info {
  position: absolute;
  top: var(--spacing-md);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  color: white;
  z-index: 10;
}

.camera-info h2 {
  font-size: 16px;
  font-weight: 500;
}

.ptz-controls {
  position: absolute;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: 10;
}

.btn-ptz-toggle {
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
}

.btn-ptz-toggle svg {
  width: 28px;
  height: 28px;
}

.ptz-overlay {
  position: absolute;
  bottom: 70px;
  right: 0;
  background: rgba(0, 0, 0, 0.85);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.ptz-dpad {
  display: grid;
  grid-template-columns: repeat(3, 50px);
  grid-template-rows: repeat(3, 50px);
  gap: 4px;
}

.ptz-btn {
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.ptz-btn:active {
  background: var(--color-accent);
  transform: scale(0.95);
}

.ptz-up { grid-column: 2; grid-row: 1; }
.ptz-left { grid-column: 1; grid-row: 2; }
.ptz-center { grid-column: 2; grid-row: 2; }
.ptz-right { grid-column: 3; grid-row: 2; }
.ptz-down { grid-column: 2; grid-row: 3; }

.ptz-zoom {
  display: flex;
  gap: 4px;
}

.ptz-zoom .ptz-btn {
  flex: 1;
  height: 50px;
}

.loading,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--spacing-lg);
}
</style>
