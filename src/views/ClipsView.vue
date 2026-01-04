<template>
  <div class="clips-view">
    <div class="header">
      <h1>{{ t('clips.title') }}</h1>
      <button @click="loadClips" class="btn-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <div class="filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        @click="activeFilter = filter.value"
        class="filter-btn"
        :class="{ active: activeFilter === filter.value }"
      >
        {{ filter.label }}
      </button>
    </div>

    <!-- Filtres avancés -->
    <div class="advanced-filters">
      <div class="filter-group">
        <label>Caméra:</label>
        <select v-model="selectedCamera" @change="loadClips">
          <option value="">Toutes les caméras</option>
          <option v-for="camera in availableCameras" :key="camera.optionValue" :value="camera.optionValue">
            {{ camera.optionDisplay }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Du:</label>
        <input type="datetime-local" v-model="startDate" @change="loadClips" />
      </div>

      <div class="filter-group">
        <label>Au:</label>
        <input type="datetime-local" v-model="endDate" @change="loadClips" />
      </div>

      <div class="filter-group">
        <button @click="resetDates" class="btn-secondary">Dernières 24h</button>
      </div>
    </div>

    <div class="clips-container">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="filteredClips.length === 0" class="empty-state">
        <p>{{ t('clips.noClips') }}</p>
      </div>

      <div v-else class="clips-list">
        <div
          v-for="clip in filteredClips"
          :key="clip.path"
          @click="playClip(clip)"
          class="clip-item"
        >
          <div 
            class="clip-thumbnail"
            @mouseenter="startPreview(clip, $event)"
            @mouseleave="stopPreview"
          >
            <img 
              :src="getClipThumbnail(clip)" 
              :alt="clip.camera" 
              @error="handleImageError" 
            />
            <div class="clip-duration">{{ formatDuration(clip.msec) }}</div>
          </div>
          
          <div class="clip-info">
            <h3>{{ clip.camera }}</h3>
            <p class="clip-date">{{ formatDate(clip.date) }}</p>
            <div class="clip-meta">
              <div class="clip-badges">
                <span class="clip-size">{{ formatSize(clip.filesize) }}</span>
                <span v-if="clip.flags & 1" class="clip-badge alert">{{ t('clips.alerts') }}</span>
                <span v-if="clip.flags & 256" class="clip-badge motion">{{ t('clips.motion') }}</span>
              </div>
              <div class="clip-detection-icons">
                <!-- Icônes de détection basées sur les zones/objets -->
                <span v-if="hasDetection(clip, 'person')" class="detection-icon person" title="Personne">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <span v-if="hasDetection(clip, 'vehicle')" class="detection-icon vehicle" title="Véhicule">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0h-.01M15 17a2 2 0 104 0m-4 0h-.01M13 6h3l4 4" />
                  </svg>
                </span>
                <span v-if="hasDetection(clip, 'animal')" class="detection-icon animal" title="Animal">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <div class="clip-actions" @click.stop>
            <button @click="downloadClip(clip)" class="btn-icon-small">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button @click="deleteClip(clip)" class="btn-icon-small">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Popup de prévisualisation vidéo -->
    <div 
      v-if="previewClip" 
      class="preview-popup"
      :style="{ top: previewPosition.y + 'px', left: previewPosition.x + 'px' }"
      @mouseenter="keepPreviewOpen = true"
      @mouseleave="stopPreview"
    >
      <img
        :src="currentPreviewFrame"
        class="preview-video"
        alt="Prévisualisation"
      />
    </div>

    <!-- Modal de lecture -->
    <div v-if="playingClip" class="video-modal" @click="closePlayer">
      <div class="modal-content" @click.stop>
        <button @click="closePlayer" class="btn-close">×</button>
        <video
          ref="clipPlayer"
          autoplay
          class="clip-player"
        ></video>
        
        <!-- Contrôles personnalisés -->
        <div class="custom-controls">
          <div class="progress-bar-container" @click="seekToPosition">
            <div class="progress-bar">
              <div class="progress-played" :style="{ width: playedPercent + '%' }"></div>
            </div>
            <div class="time-display">
              {{ formatTime(currentPlayTime) }} / {{ formatDuration(playingClip.msec) }}
            </div>
          </div>
          
          <div class="control-buttons">
            <button @click="seekRelative(-30000)" class="btn-control">-30s</button>
            <button @click="togglePlayPause" class="btn-control">
              {{ isPaused ? '▶' : '⏸' }}
            </button>
            <button @click="seekRelative(30000)" class="btn-control">+30s</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useCamerasStore } from '../stores/cameras';
import BlueIrisParser from '../utils/blueIrisParser';
import JMuxer from '../utils/jmuxer-wrapper';

const { t } = useI18n();
const authStore = useAuthStore();
const camerasStore = useCamerasStore();

const clips = ref([]);
const loading = ref(false);
const activeFilter = ref('all');
const playingClip = ref(null);
const clipPlayer = ref(null);

// Filtres avancés
const selectedCamera = ref('');
const startDate = ref('');
const endDate = ref('');

// État de prévisualisation au survol
const previewClip = ref(null);
const previewPosition = ref({ x: 0, y: 0 });
const previewTimeout = ref(null);
const keepPreviewOpen = ref(false);
const currentPreviewFrame = ref('');
const previewFrameIndex = ref(0);
let previewAnimationInterval = null;

// Variables pour le streaming
let jmuxer = null;
let parser = null;
let abortController = null;
let loadStreamAtTimeFunc = null;

// Variables de lecture
const currentPlayTime = ref(0);
const isPaused = ref(false);
const streamStartTimeMs = ref(0);
let playbackStartTime = 0;

// Caméras disponibles (exclure les groupes qui commencent par +)
const availableCameras = computed(() => {
  return camerasStore.cameras.filter(cam => !cam.optionDisplay.startsWith('+'));
});

const filters = [
  { value: 'all', label: 'Tous', cmd: 'cliplist' },
  { value: 'alerts', label: 'Alertes', cmd: 'alertlist' },
  { value: 'flagged', label: 'Marqués', cmd: 'cliplist' },
  { value: 'confirmed', label: 'Confirmés', cmd: 'alertlist' },
  { value: 'cancelled', label: 'Annulés', cmd: 'alertlist' }
];

const filteredClips = computed(() => {
  // Plus de filtrage côté client, on utilise l'API Blue Iris
  return clips.value;
});

const loadClips = async () => {
  loading.value = true;
  
  const filter = filters.find(f => f.value === activeFilter.value) || filters[0];
  const cmd = filter.cmd || 'cliplist';
  const view = filter.value === 'all' ? 'all' : filter.value;
  
  // Convertir les dates en timestamps Unix
  let startTimestamp = null;
  let endTimestamp = null;
  
  if (startDate.value) {
    startTimestamp = Math.floor(new Date(startDate.value).getTime() / 1000);
  }
  if (endDate.value) {
    endTimestamp = Math.floor(new Date(endDate.value).getTime() / 1000);
  }
  
  // Utiliser la caméra sélectionnée, ou 'index' pour toutes
  const camera = selectedCamera.value && selectedCamera.value !== '' ? selectedCamera.value : 'index';
  
  console.log('📹 Loading clips for camera:', camera, 'selected:', selectedCamera.value);
  
  const result = await authStore.apiClient.getClips(cmd, view, camera, startTimestamp, endTimestamp);
  if (result.success) {
    clips.value = result.clips || [];
    if (clips.value.length > 0) {
      console.log('📹 Loaded', clips.value.length, 'items for view:', view, 'camera:', camera);
    }
  }
  loading.value = false;
};

// Réinitialiser aux dernières 24h
const resetDates = () => {
  startDate.value = '';
  endDate.value = '';
  loadClips();
};

// Détecter le type d'objet dans le clip (basé sur le champ memo de Blue Iris)
const hasDetection = (clip, type) => {
  if (!clip.memo) return false;
  
  const memoLower = clip.memo.toLowerCase();
  
  // Détection basée sur le champ memo (ex: "car:92%", "person:85%")
  switch(type) {
    case 'person':
      return memoLower.includes('person') || 
             memoLower.includes('people') || 
             memoLower.includes('human') ||
             memoLower.includes('man') ||
             memoLower.includes('woman');
    case 'vehicle':
      return memoLower.includes('car') || 
             memoLower.includes('vehicle') || 
             memoLower.includes('truck') ||
             memoLower.includes('bus') ||
             memoLower.includes('motorcycle') ||
             memoLower.includes('bicycle');
    case 'animal':
      return memoLower.includes('dog') || 
             memoLower.includes('cat') || 
             memoLower.includes('bird') ||
             memoLower.includes('horse') ||
             memoLower.includes('animal');
    default:
      return false;
  }
};

const playClip = async (clip) => {
  playingClip.value = clip;
  
  await nextTick();
  const player = clipPlayer.value;
  if (!player) return;
  
  // Cleanup précédent
  if (abortController) abortController.abort();
  if (jmuxer) jmuxer.destroy();
  if (parser) parser.reset();
  
  // Variables
  let lastFrame = null;
  let mseReady = false;
  let earlyFrames = [];
  let streamStartTime = 0; // Temps de début du clip en ms
  
  // Parser Blue Iris
  parser = new BlueIrisParser(
    (frame) => {
      if (!jmuxer) {
        jmuxer = new JMuxer({
          node: player,
          mode: 'video',
          videoCodec: frame.codec,
          onReady: () => {
            mseReady = true;
            while (earlyFrames.length > 0) {
              const earlyFrame = earlyFrames.shift();
              feedFrame(earlyFrame);
            }
          }
        });
      }
      
      if (!mseReady) {
        earlyFrames.push(frame);
        return;
      }
      
      feedFrame(frame);
    },
    null, // pas d'audio
    (bitmapHeader) => {
      console.log('📹 Clip:', `${bitmapHeader.biWidth}x${bitmapHeader.biHeight}`);
    }
  );
  
  const feedFrame = (frame) => {
    if (lastFrame) {
      jmuxer.feed({
        video: lastFrame.frameData,
        duration: frame.time - lastFrame.time,
        isLastVideoFrameComplete: true
      });
    }
    lastFrame = frame;
  };
  
  // Fonction pour charger le stream à une position spécifique
  const loadStreamAtTime = async (timeMs) => {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    
    // Réinitialiser le parser
    if (parser) parser.reset();
    lastFrame = null;
    
    streamStartTime = timeMs;
    const url = `/file/clips/${clip.path}?session=${authStore.apiClient.session}&speed=100&audio=0&stream=0&w=1920&h=1080&q=23&kbps=1000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&extend=2&time=${Math.floor(timeMs)}`;
    
    console.log('📹 Loading clip at time:', timeMs, 'URL:', url);
    
    try {
      const response = await fetch(url, { signal: abortController.signal });
      const reader = response.body.getReader();
      
      const read = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) return;
          
          if (value) {
            parser.write(value);
            parser.parse();
          }
          
          read();
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('❌ Read error:', err);
          }
        }
      };
      
      read();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Fetch error:', err);
      }
    }
  };
  
  // Sauvegarder la fonction pour pouvoir l'appeler depuis les contrôles
  loadStreamAtTimeFunc = loadStreamAtTime;
  
  // Démarrer la mise à jour du temps de lecture
  playbackStartTime = Date.now();
  streamStartTimeMs.value = 0;
  updatePlaybackTime();
  
  // Charger depuis le début
  loadStreamAtTime(0);
};

// Mettre à jour le temps de lecture actuel
const updatePlaybackTime = () => {
  if (playingClip.value && !isPaused.value) {
    const elapsed = Date.now() - playbackStartTime;
    currentPlayTime.value = streamStartTimeMs.value + elapsed;
    requestAnimationFrame(updatePlaybackTime);
  } else if (playingClip.value && isPaused.value) {
    setTimeout(updatePlaybackTime, 100);
  }
};

// Calculer le pourcentage lu
const playedPercent = computed(() => {
  if (!playingClip.value || !playingClip.value.msec) return 0;
  return Math.min(100, (currentPlayTime.value / playingClip.value.msec) * 100);
});

// Formater le temps en mm:ss
const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Seek relatif (ex: +30s, -30s)
const seekRelative = (deltaMs) => {
  const newTime = Math.max(0, Math.min(playingClip.value.msec, currentPlayTime.value + deltaMs));
  seekToTime(newTime);
};

// Seek à une position absolue
const seekToTime = (timeMs) => {
  if (!loadStreamAtTimeFunc) return;
  
  streamStartTimeMs.value = timeMs;
  playbackStartTime = Date.now();
  currentPlayTime.value = timeMs;
  
  loadStreamAtTimeFunc(timeMs);
};

// Seek via clic sur la barre
const seekToPosition = (event) => {
  if (!playingClip.value) return;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const timeMs = percent * playingClip.value.msec;
  
  seekToTime(timeMs);
};

// Toggle play/pause
const togglePlayPause = () => {
  isPaused.value = !isPaused.value;
  
  if (isPaused.value) {
    // Pause: sauvegarder le temps actuel
    currentPlayTime.value = streamStartTimeMs.value + (Date.now() - playbackStartTime);
  } else {
    // Resume: réinitialiser le timer
    playbackStartTime = Date.now();
    updatePlaybackTime();
  }
};

const closePlayer = () => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  if (jmuxer) {
    jmuxer.destroy();
    jmuxer = null;
  }
  
  if (parser) {
    parser.reset();
    parser = null;
  }
  
  playingClip.value = null;
};

const downloadClip = (clip) => {
  const url = getClipURL(clip);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${clip.camera}_${clip.date}.mp4`;
  link.click();
};

const deleteClip = async (clip) => {
  if (confirm(t('clips.confirmDelete'))) {
    // Implémenter la suppression via API
    console.log('Delete clip:', clip);
  }
};

const getClipURL = (clip) => {
  // Blue Iris clips: demander en format MP4 pour navigation (pas vcs=3)
  // Sans vcs=3&extend=2, Blue Iris envoie du MP4 standard
  return `/file/clips/${clip.path}?session=${authStore.apiClient.session}`;
};

const getClipThumbnail = (clip) => {
  // Extraire le recId du path: @564717421766447.bvr → 564717421766447
  const recId = clip.path.replace(/@/g, '').replace(/\..*/g, '');
  // Utiliser l'endpoint thumbs de Blue Iris pour obtenir l'image du moment de détection
  return `/thumbs/@${recId}?session=${authStore.apiClient.session}`;
};

// URL pour la vidéo de prévisualisation (courte vidéo du mouvement)
const getClipPreviewURL = (clip) => {
  const recId = clip.path.replace(/@/g, '').replace(/\..*/g, '');
  // Streaming Blue Iris en taille réduite avec durée limitée dans la vidéo elle-même
  return `/file/clips/${clip.path}?session=${authStore.apiClient.session}&speed=100&audio=0&stream=1&w=640&h=360&q=15&time=0&vcs=3&extend=2`;
};

// Générer l'URL d'une miniature à un moment précis du clip
const getClipFrameURL = (clip, timeMs) => {
  const recId = clip.path.replace(/@/g, '').replace(/\..*/g, '');
  return `/file/clips/@${recId}?time=${timeMs}&cache=1&h=360&session=${authStore.apiClient.session}`;
};

// Générer une séquence de miniatures pour animer la prévisualisation
const getPreviewFrames = (clip) => {
  const frames = [];
  const duration = clip.msec || 5000; // Durée du clip en ms
  const frameInterval = 500; // Une image toutes les 500ms
  const maxFrames = 20; // Maximum 20 images
  
  const numFrames = Math.min(Math.floor(duration / frameInterval), maxFrames);
  
  for (let i = 0; i < numFrames; i++) {
    const time = i * frameInterval;
    frames.push(getClipFrameURL(clip, time));
  }
  
  return frames;
};

// Démarrer la prévisualisation vidéo au survol
const startPreview = (clip, event) => {
  keepPreviewOpen.value = false;
  
  // Attendre 500ms avant d'afficher le popup
  if (previewTimeout.value) {
    clearTimeout(previewTimeout.value);
  }
  
  previewTimeout.value = setTimeout(() => {
    // Calculer la position du popup
    const rect = event.target.closest('.clip-item').getBoundingClientRect();
    const popupWidth = 640;
    const popupHeight = 360;
    
    // Centrer horizontalement sur la vignette
    let x = rect.left + (rect.width / 2) - (popupWidth / 2);
    
    // Positionner au-dessus de la vignette avec une marge
    let y = rect.top - popupHeight - 10;
    
    // Ajuster si le popup sort de l'écran en haut
    if (y < 10) {
      y = rect.bottom + 10; // Le placer en dessous
    }
    
    // Ajuster si le popup sort de l'écran à gauche ou droite
    if (x < 10) {
      x = 10;
    } else if (x + popupWidth > window.innerWidth - 10) {
      x = window.innerWidth - popupWidth - 10;
    }
    
    previewClip.value = clip;
    previewPosition.value = { x, y };
    
    // Démarrer l'animation de prévisualisation après le prochain rendu
    nextTick(() => {
      startPreviewAnimation(clip);
    });
  }, 500);
};

// Démarrer l'animation de la prévisualisation avec des miniatures
const startPreviewAnimation = (clip) => {
  const frames = getPreviewFrames(clip);
  
  if (frames.length === 0) return;
  
  // Afficher la première image
  previewFrameIndex.value = 0;
  currentPreviewFrame.value = frames[0];
  
  // Animer en boucle toutes les 200ms
  previewAnimationInterval = setInterval(() => {
    previewFrameIndex.value = (previewFrameIndex.value + 1) % frames.length;
    currentPreviewFrame.value = frames[previewFrameIndex.value];
  }, 200);
};

// Arrêter l'animation de prévisualisation
const stopPreviewAnimation = () => {
  if (previewAnimationInterval) {
    clearInterval(previewAnimationInterval);
    previewAnimationInterval = null;
  }
  currentPreviewFrame.value = '';
  previewFrameIndex.value = 0;
};

// Arrêter la prévisualisation quand on quitte
const stopPreview = () => {
  if (previewTimeout.value) {
    clearTimeout(previewTimeout.value);
    previewTimeout.value = null;
  }
  
  // Garder le popup ouvert si on survole le popup lui-même
  setTimeout(() => {
    if (!keepPreviewOpen.value) {
      stopPreviewAnimation();
      previewClip.value = null;
    }
  }, 100);
};

// Fonction de compatibilité - non utilisée mais conservée
const resetPreviews = () => {};

const handleImageError = (e) => {
  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"%3E%3Crect fill="%23333" width="320" height="180"/%3E%3C/svg%3E';
};

const formatDuration = (msec) => {
  if (!msec) return '0:00';
  const seconds = Math.floor(msec / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

const formatSize = (filesize) => {
  if (!filesize) return '0 MB';
  // Blue Iris retourne "15m48s (502.7MB)" - extraire la taille
  const match = filesize.match(/\(([^)]+)\)/);
  return match ? match[1] : filesize;
};

// Recharger quand le filtre change
watch(activeFilter, () => {
  loadClips();
});

onMounted(async () => {
  // Charger les caméras si pas déjà fait
  if (camerasStore.cameras.length === 0) {
    await camerasStore.fetchCameras();
  }
  
  console.log('📹 Available cameras:', camerasStore.cameras);
  console.log('📹 First camera structure:', camerasStore.cameras[0]);
  
  loadClips();
});
</script>

<style scoped>
.clips-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 70px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header h1 {
  font-size: 18px;
  margin: 0;
}

.filters {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}

.advanced-filters {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.filter-group label {
  font-size: 14px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.filter-group select,
.filter-group input[type="datetime-local"] {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
}

.filter-group select option {
  background: var(--color-surface);
  color: var(--color-text);
}

.filter-group select {
  min-width: 150px;
}

.filter-group input[type="datetime-local"] {
  min-width: 200px;
}

.btn-secondary {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--color-border);
}

.filter-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}

.filter-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-background);
}

.clips-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.clips-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.clip-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
}

.clip-item:active {
  transform: scale(0.98);
}

.clip-thumbnail {
  position: relative;
  width: 120px;
  height: 68px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-background);
}

.clip-thumbnail img,
.clip-preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.clip-preview-video {
  position: absolute;
  top: 0;
  left: 0;
}

.clip-duration {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 11px;
  border-radius: 4px;
}

.clip-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.clip-info h3 {
  font-size: 16px;
  font-weight: 500;
}

.clip-date {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.clip-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  font-size: 12px;
}

.clip-badges {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.clip-detection-icons {
  display: flex;
  gap: 6px;
  align-items: center;
}

.detection-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  padding: 4px;
  transition: var(--transition);
}

.detection-icon svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.detection-icon.person {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.detection-icon.vehicle {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.detection-icon.animal {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.detection-icon:hover {
  transform: scale(1.1);
}

.clip-size {
  color: var(--color-text-secondary);
}

.clip-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.clip-badge.alert {
  background: rgba(233, 69, 96, 0.2);
  color: var(--color-error);
}

.clip-badge.motion {
  background: rgba(22, 199, 154, 0.2);
  color: var(--color-success);
}

.clip-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.btn-icon-small {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.btn-icon-small:active {
  background: var(--color-primary);
}

.btn-icon-small svg {
  width: 20px;
  height: 20px;
}

.video-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
}

/* Popup de prévisualisation au survol */
.preview-popup {
  position: fixed;
  z-index: 1001;
  background: #000;
  border: 2px solid var(--color-accent);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  pointer-events: auto;
  transition: opacity 0.2s ease;
}

.preview-video {
  width: 640px;
  height: 360px;
  display: block;
  object-fit: cover;
  background: #000;
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 800px;
}

.btn-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clip-player {
  width: 100%;
  border-radius: var(--radius-lg);
}

.clip-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  color: white;
  z-index: 10;
}

.custom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.progress-bar-container {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.progress-played {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.1s linear;
}

.time-display {
  color: white;
  font-size: 14px;
  text-align: center;
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
}

.btn-control {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  min-width: 60px;
  transition: background 0.2s;
}

.btn-control:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-control:active {
  background: rgba(255, 255, 255, 0.4);
}

.loading,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
}
</style>
