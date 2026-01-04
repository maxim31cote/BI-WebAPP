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

        <div class="video-container">
          <div v-if="streamLoading" class="stream-loading">
            <div class="spinner"></div>
            <p>{{ t('live.connecting') }}</p>
          </div>
          
          <video 
            ref="videoPlayer" 
            class="video-player"
            autoplay
            playsinline
            muted
          ></video>

          <div class="video-controls">
            <button @click="toggleAudio" class="btn-audio" :class="{ active: audioEnabled }">
              <svg v-if="audioEnabled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            </button>
            <div v-if="audioEnabled" class="volume-control">
              <input 
                type="range" 
                min="0" 
                max="100" 
                :value="audioVolume * 100" 
                @input="updateVolume($event.target.value)"
                class="volume-slider"
              />
              <span class="volume-label">{{ Math.round(audioVolume * 100) }}%</span>
            </div>
          </div>
        </div>

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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCamerasStore } from '../stores/cameras';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import JMuxer from '../utils/jmuxer-wrapper.js'; // JMuxer UI3 avec support H.265
import BlueIrisParser from '../utils/blueIrisParser';

const { t } = useI18n();
const camerasStore = useCamerasStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const loading = ref(false);
const streamLoading = ref(false);
const error = ref('');
const showPTZ = ref(false);
const videoPlayer = ref(null);
const serverStatus = ref(null);
const statusInterval = ref(null);
const audioEnabled = ref(false);
const audioVolume = ref(0.8);

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
  console.log('🧹 Clearing selection...');
  
  // Clear video player
  if (videoPlayer.value) {
    videoPlayer.value.pause();
    videoPlayer.value.src = '';
  }
  
  // The watchEffect cleanup will handle jmuxer and abortControllers
  camerasStore.clearSelection();
};

const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value;
  console.log('🔊 Audio toggled:', audioEnabled.value);
  
  // Si on désactive l'audio, on arrête juste le player sans recharger
  if (!audioEnabled.value) {
    console.log('🔇 Disabling audio only...');
    // Le watchEffect va se réexécuter et ne pas créer de nouveau pcmPlayer
    // On force juste un nouveau cycle pour nettoyer l'audio
    const currentCamera = selectedCamera.value;
    if (currentCamera) {
      // Juste déclencher un nouveau watchEffect cycle
      camerasStore.clearSelection();
      nextTick(() => {
        camerasStore.selectCamera(currentCamera);
      });
    }
  } else {
    // Si on active l'audio, on doit recharger avec le nouveau pcmPlayer
    console.log('🔊 Enabling audio...');
    const currentCamera = selectedCamera.value;
    if (currentCamera) {
      camerasStore.clearSelection();
      nextTick(() => {
        camerasStore.selectCamera(currentCamera);
      });
    }
  }
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

const updateVolume = (value) => {
  audioVolume.value = value / 100;
  if (gainNode) {
    gainNode.gain.value = audioVolume.value;
  }
};

// Streaming avec BlueIrisParser + JMuxer (comme UI3)
let jmuxer = null;
let abortController = null;
let parser = null;
let currentCamera = null;
let isStreamActive = false;
let audioContext = null;
let gainNode = null;
let audioQueue = [];
let nextPlayTime = 0;
let decoderState = { lastReceivedAudioIndex: -1, nextPlayAudioIndex: 0, buffers: [] };

// Fonction pour jouer les buffers décodés dans l'ordre (comme UI3's PlayDecodedAudio)
const playDecodedAudio = () => {
  for (let i = 0; i < decoderState.buffers.length; i++) {
    if (decoderState.buffers[i].index === decoderState.nextPlayAudioIndex) {
      decoderState.nextPlayAudioIndex++;
      const audioBuffer = decoderState.buffers[i].buffer;
      decoderState.buffers.splice(i, 1);
      
      // Resume le contexte s'il est suspendu (comme UI3)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Créer source node et connecter via GainNode pour le contrôle du volume
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      if (!gainNode) {
        gainNode = audioContext.createGain();
        gainNode.gain.value = audioVolume.value;
        gainNode.connect(audioContext.destination);
      }
      
      source.connect(gainNode);
      
      // Timing avec buffer initial (comme UI3)
      const currentTime = audioContext.currentTime;
      const duration = audioBuffer.duration;
      
      if (nextPlayTime === 0) {
        nextPlayTime = currentTime + 0.2; // Buffer initial 200ms
      }
      
      const offset = currentTime - nextPlayTime;
      const maxDelayMs = 0.7; // 700ms max
      
      if (offset > 0) {
        // Frame en retard
        nextPlayTime = currentTime;
      } else if (offset < -1 * maxDelayMs) {
        // Buffer trop plein, drop
        playDecodedAudio(); // Récursif pour jouer la suivante
        return;
      }
      
      source.start(nextPlayTime);
      nextPlayTime += duration;
      
      playDecodedAudio(); // Récursif au cas où la suivante est déjà là
      return;
    }
  }
};

// Fonction pour décoder et jouer FLAC (comme UI3's DecodeAndPlayAudioData)
const decodeAndPlayFlac = (audioData, sampleRate) => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  }
  
  // Si le sampleRate change, recréer le context
  if (audioContext.sampleRate !== sampleRate) {
    audioContext.close();
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
    gainNode = null; // Reset aussi le GainNode car il appartient à l'ancien contexte
    nextPlayTime = 0;
    decoderState = { lastReceivedAudioIndex: -1, nextPlayAudioIndex: 0, buffers: [] };
  }
  
  decoderState.lastReceivedAudioIndex++;
  const myIndex = decoderState.lastReceivedAudioIndex;
  
  // Décoder FLAC avec Web Audio API (comme UI3)
  audioContext.decodeAudioData(
    audioData.buffer,
    (audioBuffer) => {
      // Ajouter à la queue avec son index
      decoderState.buffers.push({ buffer: audioBuffer, index: myIndex });
      // Essayer de jouer dans l'ordre
      playDecodedAudio();
    },
    (error) => {
      console.error('❌ FLAC decode error:', error);
    }
  );
};

// Fonction pour démarrer/redémarrer le stream (comme UI3's ReopenStreamAtCurrentSeekPosition)
const startStream = async () => {
  const camera = selectedCamera.value;
  const player = videoPlayer.value;
  const hasAudio = audioEnabled.value;
  
  console.log('📹 Starting stream:', { camera, hasAudio, hasPlayer: !!player });
  
  if (!camera || !player) {
    console.log('⚠️ Missing camera or player, skipping');
    if (abortController) {
      try {
        abortController.abort();
      } catch (e) {}
      abortController = null;
    }
    isStreamActive = false;
    return;
  }
  
  streamLoading.value = true;
  currentCamera = camera;
  isStreamActive = true;
  
  // Comme UI3: vcs=3, audio=0 ou 1 selon le toggle
  const streamURL = camerasStore.getStreamURL(camera, settingsStore.videoQuality, hasAudio);
  console.log('🎥 Stream URL (UI3 mode):', streamURL);
  
  // Cleanup précédent
  if (abortController) {
    console.log('🛑 Aborting previous stream...');
    abortController.abort();
    abortController = null;
  }
  
  if (jmuxer) {
    console.log('🧹 Destroying previous JMuxer...');
    jmuxer.destroy();
    jmuxer = null;
  }
  
  if (audioContext && !hasAudio) {
    console.log('🧹 Closing AudioContext...');
    audioContext.close();
    audioContext = null;
    gainNode = null;
    nextPlayTime = 0;
    decoderState = { lastReceivedAudioIndex: -1, nextPlayAudioIndex: 0, buffers: [] };
  }
  
  if (parser) {
    parser.reset();
  }
  
  // Attendre que Blue Iris ferme les connexions précédentes
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Variables pour le buffering UI3-style (RÉINITIALISÉES à chaque nouveau stream)
  let lastFrame = null;
  let lastFrameDuration = 33;
  let mseReady = false;
  let earlyFrames = [];
  let audioFramesQueued = [];
  
  // Créer le parser Blue Iris (comme UI3)
  parser = new BlueIrisParser(
    // onVideoFrame
    (frame) => {
      if (!jmuxer) {
        // Créer JMuxer à la première frame (comme UI3)
        console.log(`🎬 Initializing JMuxer with codec: ${frame.codec}`);
        
        jmuxer = new JMuxer({
          node: player,
          mode: 'video', // Toujours 'video', l'audio FLAC est géré par Web Audio API
          videoCodec: frame.codec, // "H264" ou "H265" (garde la casse)
          maxDelay: 1000,
          flushingTime: 0,
          clearBuffer: true,
          debug: false,
          onReady: () => {
            console.log('✅ MSE Ready');
            mseReady = true;
            streamLoading.value = false;
            // Unmute le player si audio activé
            if (hasAudio && player) {
              player.muted = false;
              player.volume = 1.0;
              console.log('🔊 Audio enabled in player');
            }
            // Feed les VIDEO frames mises en queue
            while (earlyFrames.length > 0) {
              const earlyFrame = earlyFrames.shift();
              feedFrame(earlyFrame);
            }
            // Feed les AUDIO frames mises en queue
            if (hasAudio) {
              while (audioFramesQueued.length > 0) {
                const audioFrame = audioFramesQueued.shift();
                jmuxer.feed({
                  audio: audioFrame.frameData
                });
              }
            }
          },
          onError: (err) => {
            console.error('❌ JMuxer error:', err);
            streamLoading.value = false;
          }
        });
      }
      
      if (!mseReady) {
        // Queue frames until MSE is ready
        earlyFrames.push(frame);
        return;
      }
      
      feedFrame(frame);
    },
    // onAudioFrame
    (frame) => {
      if (!hasAudio) return; // Utiliser la valeur capturée, pas réactive
      
      // FLAC (wFormatTag=61868=0xF1AC) - Décoder avec Web Audio API
      if (frame.format?.wFormatTag === 61868) {
        decodeAndPlayFlac(frame.frameData, frame.format.nSamplesPerSec);
        return;
      }
      
      // Pour les autres formats (AAC, μ-law), utiliser JMuxer
      if (!mseReady) {
        // Queue audio frames until MSE is ready
        audioFramesQueued.push(frame);
        return;
      }
      
      // Feed l'audio à JMuxer (il gère AAC automatiquement)
      if (jmuxer) {
        jmuxer.feed({
          audio: frame.frameData
        });
      }
    },
    // onStreamInfo
    (bitmapHeader, audioHeader) => {
      const audioFormat = audioHeader ? (
        audioHeader.wFormatTag === 61868 ? 'FLAC' :
        audioHeader.wFormatTag === 7 ? 'μ-law' :
        audioHeader.wFormatTag === 255 ? 'AAC' : `format ${audioHeader.wFormatTag}`
      ) : 'none';
      console.log('📊 Stream info:', {
        video: bitmapHeader ? `${bitmapHeader.biWidth}x${bitmapHeader.biHeight} ${bitmapHeader.biCompression}` : 'none',
        audio: audioHeader ? `${audioFormat} ${audioHeader.nSamplesPerSec}Hz ${audioHeader.nChannels}ch` : 'none'
      });
    },
    // onStatusBlock
    (status) => {
      // Status updates (recording, motion, etc.)
      if (status.bMotion) {
        console.log('🚨 Motion detected');
      }
    }
  );
  
  // Fonction pour feed les frames comme UI3 (buffer + duration)
  const feedFrame = (frame) => {
    if (lastFrame) {
      // Calculer la durée entre frames
      lastFrameDuration = frame.time - lastFrame.time;
      
      // Feed la FRAME PRÉCÉDENTE avec la durée calculée
      jmuxer.feed({
        video: lastFrame.frameData,
        duration: lastFrameDuration,
        isLastVideoFrameComplete: true
      });
    }
    
    // Stocker la frame courante pour le prochain cycle
    lastFrame = frame;
  };
  
  // Créer nouveaux controllers
  abortController = new AbortController();
  
  // Fetch et parse le stream
  let chunkCount = 0;
  
  try {
    const response = await fetch(streamURL, { signal: abortController.signal });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    
    const read = async () => {
      try {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream ended gracefully');
          return;
        }
        
        if (value) {
          chunkCount++;
          if (chunkCount % 100 === 1) {
            console.log(`📦 Chunk #${chunkCount}: ${value.length} bytes`);
          }
          
          // Feed les données au parser
          parser.write(value);
          
          try {
            const result = parser.parse();
            if (result && result.ended) {
              console.log('🏁 Stream ended by server');
              return;
            }
          } catch (err) {
            console.error('❌ Parse error:', err);
            streamLoading.value = false;
            return;
          }
        }
        
        read();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('❌ Read error:', err);
          streamLoading.value = false;
        }
      }
    };
    
    read();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('❌ Fetch error:', err);
      streamLoading.value = false;
      streamError.value = `Erreur de streaming: ${err.message}`;
    }
  }
};

// Watcher pour changement de caméra
watch(selectedCamera, () => {
  console.log('🔄 Camera changed');
  startStream();
});

// Watcher pour toggle audio (comme UI3's AudioToggleNotify)
watch(audioEnabled, (newValue, oldValue) => {
  console.log('🔊 Audio toggle:', { from: oldValue, to: newValue });
  
  // Si un stream est actif, le rouvrir avec le nouveau paramètre audio (comme UI3)
  if (isStreamActive && currentCamera) {
    console.log('🔄 Reopening stream with audio:', newValue);
    startStream();
  }
});

// Watcher pour le player (initial mount)
watch(videoPlayer, (player) => {
  if (player && selectedCamera.value) {
    console.log('🎬 Player ready');
    startStream();
  }
});

onMounted(async () => {
  await loadCameras();
  camerasStore.startAutoUpdate();
  
  // Mettre à jour le status du serveur
  updateServerStatus();
  statusInterval.value = setInterval(updateServerStatus, 2000);
});


onUnmounted(() => {
  console.log('🧹 LiveView unmounting, cleaning up...');
  camerasStore.stopAutoUpdate();
  
  // Abort streams
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  // Close AudioContext
  if (audioContext) {
    console.log('🔇 Closing AudioContext');
    audioContext.close();
    audioContext = null;
    gainNode = null;
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
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.header h1 {
  font-size: 18px;
  margin: 0;
}

.server-info {
  display: flex;
  gap: var(--spacing-md);
  font-size: 11px;
  opacity: 0.8;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-item .label {
  color: var(--color-text-secondary);
  font-size: 10px;
}

.info-item .value {
  font-weight: 600;
  font-size: 11px;
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

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.stream-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  z-index: 5;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
}

.stream-loading p {
  font-size: 14px;
  margin: 0;
}

.video-controls {
  position: absolute;
  bottom: var(--spacing-lg);
  left: var(--spacing-lg);
  display: flex;
  gap: var(--spacing-sm);
  z-index: 10;
}

.btn-audio {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.btn-audio:hover {
  background: rgba(0, 0, 0, 0.8);
}

.btn-audio.active {
  background: var(--color-accent);
}

.btn-audio svg {
  width: 24px;
  height: 24px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md);
  background: rgba(0, 0, 0, 0.6);
  border-radius: 24px;
  height: 48px;
  backdrop-filter: blur(10px);
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.volume-slider {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  transition: var(--transition);
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: var(--transition);
}

.volume-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.volume-label {
  color: white;
  font-size: 12px;
  font-weight: 500;
  min-width: 35px;
  text-align: center;
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
