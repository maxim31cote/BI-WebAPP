<template>
  <div class="timeline-view">
    <!-- Header compact -->
    <div class="header" v-if="!fullscreenCamera">
      <h1>{{ t('timeline.title') }}</h1>
      
      <!-- Navigation de date -->
      <div class="date-picker">
        <button @click="previousDay" class="btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        
        <input
          v-model="selectedDate"
          type="date"
          class="input date-input"
        >
        
        <button @click="nextDay" class="btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>

      <!-- Filtres de caméras -->
      <div class="camera-filters">
        <button @click="showAllCameras" class="filter-btn" :class="{ active: visibleCameras.size === 0 }">
          Toutes
        </button>
        <button 
          v-for="camera in availableCameras" 
          :key="camera.optionValue"
          @click="toggleCamera(camera.optionValue)"
          class="filter-btn"
          :class="{ active: visibleCameras.size === 0 || visibleCameras.has(camera.optionValue) }"
        >
          {{ camera.optionDisplay }}
        </button>
      </div>
    </div>

    <!-- Grille de caméras -->
    <div class="cameras-grid" v-if="!fullscreenCamera">
      <div
        v-for="camera in filteredCameras"
        :key="camera.optionValue"
        class="camera-cell"
        :class="{ inactive: !isCameraActiveAtTime(camera.optionValue) }"
      >
        <div class="camera-name">{{ camera.optionDisplay }}</div>
        <canvas
          :ref="el => cameraCanvases[camera.optionValue] = el"
          class="camera-canvas"
          @click="openFullscreenCamera(camera.optionValue)"
          style="cursor: pointer;"
        />
      </div>
    </div>

    <!-- Vue plein écran pour une caméra -->
    <div class="fullscreen-camera" v-if="fullscreenCamera">
      <div class="fullscreen-header">
        <h2>{{ availableCameras.find(c => c.optionValue === fullscreenCamera)?.optionDisplay }}</h2>
        <button @click="closeFullscreenCamera" class="btn-close">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="fullscreen-video-container">
        <video id="fullscreen-video" autoplay muted playsinline></video>
      </div>
    </div>

    <!-- Barre de timeline au bas -->
    <div class="timeline-bar">
      <!-- Contrôles de lecture -->
      <div class="playback-controls">
        <button @click="goLive" class="btn-live" :class="{ active: isLive }" title="Passer en direct">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
          LIVE
        </button>
        
        <button @click="togglePlayPause" class="btn-play" :title="isPlaying ? 'Pause' : 'Lecture'">
          <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"></path>
          </svg>
        </button>
        
        <div class="speed-controls">
          <button 
            v-for="speed in playbackSpeeds" 
            :key="speed"
            @click="setPlaybackSpeed(speed)"
            class="btn-speed"
            :class="{ active: playbackSpeed === speed }"
          >
            {{ speed }}x
          </button>
        </div>
        
        <div class="zoom-controls">
          <button @click="zoomOut" class="btn-zoom" title="Dézoomer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
            </svg>
          </button>
          <span class="zoom-label">{{ zoomLevels[zoomLevel].label }}</span>
          <button @click="zoomIn" class="btn-zoom" title="Zoomer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="timeline-hours">
        <span 
          v-for="marker in visibleHourMarkers" 
          :key="marker.hour" 
          class="hour-marker"
          :style="{ left: marker.position + '%' }"
        >
          {{ marker.minute > 0 ? `${String(marker.hour).padStart(2, '0')}:${String(marker.minute).padStart(2, '0')}` : `${String(marker.hour).padStart(2, '0')}:00` }}
        </span>
      </div>
      
      <div class="timeline-track" ref="timelineTrack" @click="seekToTime" @mousedown="startDrag">
        <!-- Événements visualisés (uniquement ceux dans la plage visible) -->
        <div
          v-for="event in visibleEvents"
          :key="event.path"
          class="event-marker"
          :class="getEventClass(event)"
          :style="{ left: getEventPosition(event) + '%', width: getEventWidth(event) + '%' }"
          :title="`${event.camera} - ${event.memo || 'Motion'}`"
        ></div>
        
        <!-- Curseur de position -->
        <div class="timeline-cursor" :style="{ left: cursorPosition + '%' }">
          <div class="cursor-handle"></div>
          <div class="cursor-time">{{ formatCursorTime }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useCamerasStore } from '../stores/cameras';
import JMuxer from '../utils/jmuxer-wrapper.js';
import BlueIrisParser from '../utils/blueIrisParser';

const { t } = useI18n();
const authStore = useAuthStore();
const camerasStore = useCamerasStore();

// Fonction helper pour obtenir la date locale au format YYYY-MM-DD
const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// État
const selectedDate = ref(getLocalDateString());
const dayEvents = ref([]);
const loading = ref(false);
const visibleCameras = ref(new Set());
const cameraCanvases = ref({});
const timelineTrack = ref(null);

// Initialiser le curseur à l'heure actuelle en mode LIVE
const getCurrentTimePercent = () => {
  const now = new Date();
  const msIntoDay = now.getHours() * 60 * 60 * 1000 + 
                    now.getMinutes() * 60 * 1000 + 
                    now.getSeconds() * 1000 +
                    now.getMilliseconds();
  const totalMsInDay = 24 * 60 * 60 * 1000;
  return (msIntoDay / totalMsInDay) * 100;
};

const cursorPosition = ref(getCurrentTimePercent());

const isDragging = ref(false);

// Mode plein écran pour une caméra
const fullscreenCamera = ref(null); // ID de la caméra en plein écran
let fullscreenVideo = null;
let fullscreenJmuxer = null;
let fullscreenParser = null;
let fullscreenAbortController = null;

// Mode live
const isLive = ref(true);
let liveUpdateInterval = null;
const mosaicImg = ref(null); // Image source unique pour toutes les caméras
const cameraRects = ref({}); // Coordonnées de chaque caméra dans la mosaïque
let jmuxer = null;
let parser = null;
let abortController = null;
let mosaicVideo = null; // Hidden video element for frame capture
let captureInterval = null;
let isMosaicStreamActive = false; // Guard pour éviter les redémarrages multiples
let retryTimeout = null; // Timeout pour les retry
let lastHistoricalPosition = null; // Dernière position du stream historique
let seekDebounceTimeout = null; // Debounce pour le seek manuel
let fullscreenSeekDebounceTimeout = null; // Debounce pour le seek en fullscreen

// Contrôles de lecture
const isPlaying = ref(true);
const playbackSpeed = ref(1);
const playbackSpeeds = [1, 2, 5, 10, 20, 50];

// Calculer le speed pour les streams (0 = pause, 100 = 1x, 200 = 2x, etc.)
const streamSpeed = computed(() => {
  return isPlaying.value ? (100 * playbackSpeed.value) : 0;
});
let playbackAnimationFrame = null;
let lastPlaybackTime = null;

// Contrôles de zoom
const zoomLevel = ref(0); // Index dans zoomLevels
const zoomLevels = [
  { scale: 1, label: '24h', hours: 24 },
  { scale: 2, label: '12h', hours: 12 },
  { scale: 4, label: '6h', hours: 6 },
  { scale: 8, label: '3h', hours: 3 },
  { scale: 16, label: '1.5h', hours: 1.5 },
  { scale: 32, label: '45min', hours: 0.75 },
  { scale: 48, label: '30min', hours: 0.5 },
  { scale: 96, label: '15min', hours: 0.25 }
];

// Plage visible en fonction du zoom
const visibleRange = computed(() => {
  const dayMs = 24 * 60 * 60 * 1000;
  const currentZoom = zoomLevels[zoomLevel.value];
  const visibleMs = dayMs / currentZoom.scale;
  
  // Toujours utiliser 24h complètes pour l'affichage
  const maxDayMs = dayMs;
  
  // Centrer sur la position du curseur
  const cursorMs = (cursorPosition.value / 100) * maxDayMs;
  let startMs = cursorMs - visibleMs / 2;
  let endMs = cursorMs + visibleMs / 2;
  
  // Ajuster si on dépasse les bornes
  if (startMs < 0) {
    endMs -= startMs;
    startMs = 0;
  }
  if (endMs > maxDayMs) {
    startMs -= (endMs - maxDayMs);
    endMs = maxDayMs;
  }
  startMs = Math.max(0, startMs);
  endMs = Math.min(maxDayMs, endMs);
  
  return { startMs, endMs, durationMs: endMs - startMs };
});

// Marqueurs d'heures visibles
const visibleHourMarkers = computed(() => {
  const range = visibleRange.value;
  const markers = [];
  const hourMs = 3600000;
  
  // Déterminer l'intervalle entre les marqueurs selon le zoom
  const currentZoom = zoomLevels[zoomLevel.value];
  let interval = hourMs; // 1 heure par défaut
  
  if (currentZoom.hours <= 1) {
    interval = 900000; // 15 minutes si zoom < 1h
  } else if (currentZoom.hours <= 3) {
    interval = 1800000; // 30 minutes si zoom <= 3h
  }
  
  let currentMs = Math.floor(range.startMs / interval) * interval;
  
  while (currentMs <= range.endMs) {
    if (currentMs >= range.startMs) {
      const totalMinutes = Math.floor(currentMs / 60000);
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const position = ((currentMs - range.startMs) / range.durationMs) * 100;
      
      markers.push({
        hour: hour,
        minute: minute,
        position: position
      });
    }
    currentMs += interval;
  }
  
  return markers;
});

// Caméras disponibles (exclure les groupes)
const availableCameras = computed(() => {
  return camerasStore.cameras.filter(cam => !cam.optionDisplay.startsWith('+'));
});

// Caméras filtrées pour affichage
const filteredCameras = computed(() => {
  if (visibleCameras.value.size === 0) return availableCameras.value;
  return availableCameras.value.filter(cam => visibleCameras.value.has(cam.optionValue));
});

// Événements visibles dans la plage de zoom actuelle
const visibleEvents = computed(() => {
  return dayEvents.value.filter(event => {
    // Si une caméra est en plein écran, afficher seulement ses événements
    if (fullscreenCamera.value && event.camera !== fullscreenCamera.value) {
      return false;
    }
    
    const pos = getEventPosition(event);
    return pos >= 0 && pos <= 100; // Exclure les événements hors de la vue
  });
});

// Temps actuel basé sur le curseur (en ms depuis minuit)
const currentTimeMs = computed(() => {
  // Toujours utiliser 24h complètes pour le calcul
  const dayMs = 24 * 60 * 60 * 1000;
  return (cursorPosition.value / 100) * dayMs;
});

// Formattage du temps du curseur
const formatCursorTime = computed(() => {
  const ms = currentTimeMs.value;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

// Navigation de date
const previousDay = () => {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  selectedDate.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const nextDay = () => {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  selectedDate.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Filtres de caméras
const showAllCameras = () => {
  visibleCameras.value.clear();
};

const toggleCamera = (cameraId) => {
  if (visibleCameras.value.has(cameraId)) {
    visibleCameras.value.delete(cameraId);
  } else {
    visibleCameras.value.add(cameraId);
  }
};

// Charger les événements de la journée (alertes + enregistrements continus)
const loadDayEvents = async () => {
  loading.value = true;
  
  try {
    // Utiliser le début de la journée en heure locale
    // IMPORTANT: Parser manuellement pour éviter les problèmes de fuseau horaire
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const startTimestamp = Math.floor(dayStart.getTime() / 1000);
    const endTimestamp = startTimestamp + (24 * 60 * 60);
    
    // Charger TOUS les clips (alertes ET enregistrements continus)
    const [alertResult, clipResult] = await Promise.all([
      authStore.apiClient.getClips('alertlist', 'all', 'index', startTimestamp, endTimestamp),
      authStore.apiClient.getClips('cliplist', 'all', 'index', startTimestamp, endTimestamp)
    ]);
    
    // Fusionner les résultats et éliminer les doublons
    const allClips = [];
    const seenPaths = new Set();
    
    if (alertResult.success && alertResult.clips) {
      for (const clip of alertResult.clips) {
        if (!seenPaths.has(clip.path)) {
          allClips.push(clip);
          seenPaths.add(clip.path);
        }
      }
    }
    
    if (clipResult.success && clipResult.clips) {
      for (const clip of clipResult.clips) {
        if (!seenPaths.has(clip.path)) {
          allClips.push(clip);
          seenPaths.add(clip.path);
        }
      }
    }
    
    // Trier par date
    allClips.sort((a, b) => a.date - b.date);
    
    dayEvents.value = allClips;
    
    // Log détaillé pour debug
    console.log(`📅 Loaded ${dayEvents.value.length} clips for ${selectedDate.value}`);
    
    // Analyser la couverture par caméra
    const cameraStats = {};
    dayEvents.value.forEach(clip => {
      if (!cameraStats[clip.camera]) {
        cameraStats[clip.camera] = { count: 0, totalDuration: 0 };
      }
      cameraStats[clip.camera].count++;
      cameraStats[clip.camera].totalDuration += (clip.msec / 1000);
    });
    
    console.log('📊 Couverture par caméra:');
    Object.entries(cameraStats).forEach(([cam, stats]) => {
      const hours = (stats.totalDuration / 3600).toFixed(1);
      console.log(`  ${cam}: ${stats.count} clips, ${hours}h de vidéo`);
    });
  } catch (err) {
    console.error('❌ Error loading day events:', err);
  } finally {
    loading.value = false;
  }
};

// Position d'un événement sur la timeline (en %) avec zoom
const getEventPosition = (event) => {
  // event.date est en secondes Unix timestamp
  const eventTime = new Date(event.date * 1000);
  
  // Début de la journée sélectionnée en heure locale
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  const msFromMidnight = eventTime.getTime() - dayStart.getTime();
  const range = visibleRange.value;
  
  // Vérifier si l'événement est dans la plage visible
  if (msFromMidnight < range.startMs || msFromMidnight > range.endMs) {
    return -100; // Hors de la vue
  }
  
  return ((msFromMidnight - range.startMs) / range.durationMs) * 100;
};

// Largeur d'un événement (basée sur la durée) avec zoom
const getEventWidth = (event) => {
  if (!event.msec) return 0.5; // Minimum width
  const durationMs = event.msec;
  const range = visibleRange.value;
  return Math.max(0.2, (durationMs / range.durationMs) * 100);
};

// Classe CSS pour un événement
const getEventClass = (event) => {
  if (event.memo) {
    if (event.memo.toLowerCase().includes('car')) return 'event-vehicle';
    if (event.memo.toLowerCase().includes('person')) return 'event-person';
  }
  if (event.flags & 1) return 'event-alert';
  return 'event-motion';
};

// Vérifier si une caméra a de la vidéo au temps actuel
const isCameraActiveAtTime = (cameraId) => {
  // En mode LIVE, toutes les caméras streamées sont actives
  if (isLive.value) {
    return true;
  }
  
  // Début de la journée en heure locale
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  const targetTime = dayStart.getTime() + currentTimeMs.value;
  const targetTimestamp = targetTime / 1000;
  
  // Chercher si un événement existe pour cette caméra à ce moment
  return dayEvents.value.some(event => {
    if (event.camera !== cameraId) return false;
    const eventStart = event.date;
    const eventEnd = eventStart + (event.msec / 1000);
    return targetTimestamp >= eventStart && targetTimestamp <= eventEnd;
  });
};

// Contrôles de zoom
const zoomIn = () => {
  if (zoomLevel.value < zoomLevels.length - 1) {
    zoomLevel.value++;
  }
};

const zoomOut = () => {
  if (zoomLevel.value > 0) {
    zoomLevel.value--;
  }
};

// Contrôles de lecture
const goLive = () => {
  // Vérifier que c'est aujourd'hui (en heure locale)
  const today = getLocalDateString();
  
  if (selectedDate.value !== today) {
    // Aller à aujourd'hui
    selectedDate.value = today;
  }
  
  // Mettre le curseur à l'heure actuelle
  cursorPosition.value = getCurrentTimePercent();
  
  // Activer le mode live
  isLive.value = true;
  
  // Arrêter la lecture normale
  if (isPlaying.value) {
    stopPlayback();
  }
  
  // Pas besoin d'interval en mode live - on utilise MJPEG
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
    liveUpdateInterval = null;
  }
  
  // Mise à jour immédiate pour passer en MJPEG
  updateAllStreams();
};

const togglePlayPause = () => {
  // Désactiver le mode live si on lance la lecture
  if (isLive.value) {
    isLive.value = false;
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
    // Arrêter le stream mosaïque
    stopMosaicStream();
  }
  
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startPlayback();
  } else {
    stopPlayback();
  }
  
  // Redémarrer les streams immédiatement avec le nouveau speed (pause ou lecture)
  if (!isLive.value) {
    updateAllStreams(false, true); // immediate = true pour redémarrage instantané
    if (fullscreenCamera.value) {
      startFullscreenStream();
    }
  }
};

const setPlaybackSpeed = (speed) => {
  playbackSpeed.value = speed;
  
  // Redémarrer les streams immédiatement avec la nouvelle vitesse
  if (!isLive.value && isPlaying.value) {
    updateAllStreams(false, true); // immediate = true pour redémarrage instantané
    if (fullscreenCamera.value) {
      startFullscreenStream();
    }
  }
};

const startPlayback = () => {
  lastPlaybackTime = performance.now();
  playbackAnimationFrame = requestAnimationFrame(updatePlayback);
};

const stopPlayback = () => {
  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame);
    playbackAnimationFrame = null;
  }
  lastPlaybackTime = null;
};

const updatePlayback = (currentTime) => {
  if (!isPlaying.value) return;
  
  if (lastPlaybackTime) {
    const deltaMs = currentTime - lastPlaybackTime;
    const progressMs = deltaMs * playbackSpeed.value;
    
    // Convertir en pourcentage de la journée (toujours 24h)
    const today = getLocalDateString();
    const isToday = selectedDate.value === today;
    
    const maxDayMs = 24 * 60 * 60 * 1000;
    const deltaPercent = (progressMs / maxDayMs) * 100;
    
    cursorPosition.value += deltaPercent;
    
    // Si aujourd'hui, limiter à l'heure actuelle
    if (isToday) {
      const now = new Date();
      const currentTimeMs = now.getHours() * 60 * 60 * 1000 + 
                           now.getMinutes() * 60 * 1000 + 
                           now.getSeconds() * 1000;
      const currentPercent = (currentTimeMs / maxDayMs) * 100;
      
      if (cursorPosition.value >= currentPercent) {
        cursorPosition.value = currentPercent;
        stopPlayback();
      }
    } else if (cursorPosition.value >= 100) {
      // Boucler pour les jours passés
      cursorPosition.value = 0;
      // Repositionner le stream au début
      if (!isLive.value) {
        updateAllStreams(true);
      }
    }
  }
  
  lastPlaybackTime = currentTime;
  playbackAnimationFrame = requestAnimationFrame(updatePlayback);
};

// Interaction avec la timeline
const seekToTime = (e) => {
  if (!timelineTrack.value) return;
  
  // Désactiver le mode live si on déplace le curseur
  if (isLive.value) {
    isLive.value = false;
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
  }
  
  const rect = timelineTrack.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const clickPercent = (x / rect.width) * 100; // Pourcentage dans la zone visible
  
  // Convertir en position absolue dans la journée en tenant compte du zoom
  const dayMs = 24 * 60 * 60 * 1000;
  const range = visibleRange.value;
  
  // Position en ms dans la plage visible
  const msInVisibleRange = (clickPercent / 100) * range.durationMs;
  const absoluteMs = range.startMs + msInVisibleRange;
  
  // Convertir en pourcentage de la journée complète
  let percentage = (absoluteMs / dayMs) * 100;
  
  // Si aujourd'hui, limiter à l'heure actuelle
  const today = getLocalDateString();
  const isToday = selectedDate.value === today;
  if (isToday) {
    const now = new Date();
    const currentTimeMs = now.getHours() * 60 * 60 * 1000 + 
                         now.getMinutes() * 60 * 1000 + 
                         now.getSeconds() * 1000;
    const currentPercent = (currentTimeMs / dayMs) * 100;
    percentage = Math.max(0, Math.min(currentPercent, percentage));
  } else {
    percentage = Math.max(0, Math.min(100, percentage));
  }
  
  cursorPosition.value = percentage;
  updateAllStreams(true); // Force restart pour seek manuel
};

const startDrag = (e) => {
  isDragging.value = true;
  seekToTime(e);
  
  const onMouseMove = (e) => {
    if (isDragging.value) {
      seekToTime(e);
    }
  };
  
  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// Mettre à jour tous les streams à la position du curseur
const updateAllStreams = (forceRestart = false, immediate = false) => {
  if (isLive.value) {
    // En mode live, démarrer le stream mosaïque une seule fois
    if (!isMosaicStreamActive) {
      startMosaicStream();
    }
  } else {
    // En mode historique avec stream mosaïque
    const currentPos = currentTimeMs.value;
    
    // Redémarrer seulement si:
    // 1. Force restart (seek manuel avec debounce)
    // 2. Pas de stream actif
    // 3. Position a beaucoup changé (>5 secondes de différence)
    const shouldRestart = !forceRestart && (
                         !isMosaicStreamActive || 
                         !lastHistoricalPosition ||
                         Math.abs(currentPos - lastHistoricalPosition) > 5000);
    
    if (shouldRestart || immediate) {
      lastHistoricalPosition = currentPos;
      stopMosaicStream();
      startMosaicStream();
    } else if (forceRestart) {
      // Pour le seek manuel, debounce pour éviter trop de requêtes
      if (seekDebounceTimeout) {
        clearTimeout(seekDebounceTimeout);
      }
      seekDebounceTimeout = setTimeout(() => {
        lastHistoricalPosition = currentPos;
        stopMosaicStream();
        startMosaicStream();
      }, 300); // Attendre 300ms après le dernier mouvement
    }
  }
};

// Démarrer le stream mosaïque avec JMuxer (approche UI3 avec H.264/H.265)
const startMosaicStream = async () => {
  // Éviter les appels multiples pendant qu'un stream est actif
  if (isMosaicStreamActive) {
    console.log('⏭️ Stream mosaïque déjà actif, skip');
    return;
  }
  
  stopMosaicStream();
  isMosaicStreamActive = true;
  
  let mosaicUrl;
  
  if (isLive.value) {
    // Mode LIVE: stream en temps réel
    mosaicUrl = `/video/index/2.0?session=${authStore.apiClient.session}&audio=0&stream=0&w=1648&h=1080&q=23&kbps=1000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&extend=2`;
  } else {
    // Mode historique: lecture à partir d'un timestamp
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const posMs = dayStart.getTime() + currentTimeMs.value;
    
    mosaicUrl = `/time/index?session=${authStore.apiClient.session}&pos=${posMs}&audio=0&stream=0&w=1648&h=1080&q=23&kbps=1000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&speed=${streamSpeed.value}&extend=2`;
  }
  
  console.log('🎬 Starting mosaic H.264/H.265 stream:', mosaicUrl);
  
  // Utiliser le mapping statique des caméras
  useStaticMapping();
  
  // Créer un élément vidéo caché pour récupérer les frames
  mosaicVideo = document.createElement('video');
  mosaicVideo.muted = true;
  mosaicVideo.playsInline = true;
  mosaicVideo.style.position = 'absolute';
  mosaicVideo.style.top = '-9999px';
  mosaicVideo.style.width = '1648px';
  mosaicVideo.style.height = '1080px';
  document.body.appendChild(mosaicVideo);
  
  // Variables pour le buffering
  let mseReady = false;
  let earlyFrames = [];
  
  // Créer le parser Blue Iris
  parser = new BlueIrisParser(
    // onVideoFrame
    (frame) => {
      if (!jmuxer) {
        console.log(`🎬 Initializing JMuxer with codec: ${frame.codec}`);
        
        jmuxer = new JMuxer({
          node: mosaicVideo,
          mode: 'video',
          videoCodec: frame.codec,
          maxDelay: 1000,
          flushingTime: 0,
          clearBuffer: true,
          debug: false,
          onReady: () => {
            console.log('✅ MSE Ready for mosaic');
            mseReady = true;
            
            // Feed frames en attente
            while (earlyFrames.length > 0) {
              const earlyFrame = earlyFrames.shift();
              jmuxer.feed({ video: earlyFrame.frameData });
            }
            
            // Démarrer la lecture vidéo
            mosaicVideo.play().then(() => {
              console.log('▶️ Mosaic video playing');
              // Démarrer la capture de frames
              startFrameCapture();
            }).catch(err => {
              console.error('❌ Failed to play mosaic video:', err);
            });
          },
          onError: (err) => {
            console.error('❌ JMuxer error:', err);
          }
        });
      }
      
      if (!mseReady) {
        earlyFrames.push(frame);
        return;
      }
      
      jmuxer.feed({ video: frame.frameData });
    },
    // onAudioFrame - ignoré
    () => {},
    // onStreamInfo
    (bitmapHeader, audioHeader) => {
      console.log('📊 Mosaic stream info:', {
        video: bitmapHeader ? `${bitmapHeader.biWidth}x${bitmapHeader.biHeight} ${bitmapHeader.biCompression}` : 'none',
        audio: audioHeader ? `format ${audioHeader.wFormatTag}` : 'none'
      });
    },
    // onStatusBlock
    (status) => {
      // Status updates du stream mosaïque (optionnel)
    }
  );
  
  // Démarrer le fetch du stream
  abortController = new AbortController();
  
  try {
    const response = await fetch(mosaicUrl, {
      signal: abortController.signal,
      headers: {
        'Accept': 'video/mpeg, video/*, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    
    let chunkCount = 0;
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('📡 Stream ended');
        break;
      }
      
      chunkCount++;
      if (chunkCount <= 3) {
        // Logger les premiers chunks pour debug
        const preview = value.slice(0, 20);
        const textPreview = new TextDecoder('utf-8', { fatal: false }).decode(preview);
        console.log(`📦 Chunk #${chunkCount}: ${value.length} bytes, starts with: "${textPreview}" (hex: ${Array.from(preview).map(b => b.toString(16).padStart(2, '0')).join(' ')})`);
      }
      
      // Feed les chunks au parser qui va extraire les frames vidéo
      parser.write(value);
      parser.parse(); // Important: déclenche le parsing après write
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('❌ Stream error:', error);
      
      // Si erreur 503 (Service Unavailable), retry après un délai
      if (error.message && error.message.includes('503')) {
        console.log('⏳ Erreur 503, retry dans 5 secondes...');
        if (retryTimeout) clearTimeout(retryTimeout);
        retryTimeout = setTimeout(() => {
          isMosaicStreamActive = false;
          if (isLive.value) {
            startMosaicStream();
          }
        }, 5000);
      }
    }
  } finally {
    // Réinitialiser le flag après la fin du stream
    isMosaicStreamActive = false;
  }
};

// Capturer les frames depuis la vidéo et les découper
const startFrameCapture = () => {
  if (captureInterval) clearInterval(captureInterval);
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1648;
  tempCanvas.height = 1080;
  const tempCtx = tempCanvas.getContext('2d');
  
  let frameCount = 0;
  
  captureInterval = setInterval(() => {
    if (!mosaicVideo || mosaicVideo.paused || mosaicVideo.ended) {
      return;
    }
    
    // Dessiner la vidéo sur le canvas temporaire
    tempCtx.drawImage(mosaicVideo, 0, 0, 1648, 1080);
    
    // Créer une image depuis le canvas
    const img = new Image();
    img.onload = () => {
      mosaicImg.value = img;
      drawMosaicToCanvases();
      frameCount++;
      if (frameCount <= 5 || frameCount % 60 === 0) {
        console.log('✅ Frame captured:', frameCount);
      }
    };
    img.src = tempCanvas.toDataURL('image/jpeg', 0.92);
  }, 66); // ~15 fps
};

// Arrêter le stream mosaïque
const stopMosaicStream = () => {
  isMosaicStreamActive = false;
  
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
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
  
  if (mosaicVideo) {
    mosaicVideo.pause();
    mosaicVideo.src = '';
    if (mosaicVideo.parentNode) {
      mosaicVideo.parentNode.removeChild(mosaicVideo);
    }
    mosaicVideo = null;
  }
  
  if (mosaicImg.value) {
    mosaicImg.value = null;
  }
  
  cameraRects.value = {};
};

// Utiliser un mapping statique si les headers ne sont pas disponibles
const useStaticMapping = () => {
  const staticCamList = ["voliere","NC","milan","poulailler","courscote","garagedetache","livia","soussol5056","cam3141","porteav","cours5056","chemin","julia"];
  const staticRecList = [[2,62,246,495],[250,21,524,228],[528,23,890,225],[894,21,1258,228],[1262,62,1646,494],[250,251,752,536],[756,251,1258,536],[5,559,425,795],[432,566,880,1070],[894,559,1208,795],[1222,559,1646,795],[2,828,428,1067],[1034,818,1496,1078]];
  
  cameraRects.value = {};
  staticCamList.forEach((cameraName, index) => {
    if (staticRecList[index]) {
      const [x1, y1, x2, y2] = staticRecList[index];
      cameraRects.value[cameraName] = {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1
      };
    }
  });
  
  console.log('Using static camera mapping:', cameraRects.value);
};

// Parser le mapping caméra -> coordonnées depuis x-camlist et x-reclist
const parseCameraMapping = (camlist, reclist) => {
  try {
    // Parser x-camlist: "cam1","cam2","cam3",...
    const cameras = camlist.match(/"([^"]+)"/g).map(s => s.replace(/"/g, ''));
    
    // Parser x-reclist: [x1,y1,x2,y2],[x1,y1,x2,y2],...
    const rects = JSON.parse(`[${reclist}]`);
    
    console.log('Parsed cameras:', cameras);
    console.log('Parsed rects:', rects);
    
    // Créer le mapping caméra -> rectangle
    cameraRects.value = {};
    cameras.forEach((cameraName, index) => {
      if (rects[index]) {
        const [x1, y1, x2, y2] = rects[index];
        cameraRects.value[cameraName] = {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1
        };
      }
    });
    
    console.log('Camera rects mapping:', cameraRects.value);
  } catch (err) {
    console.error('Failed to parse camera mapping:', err);
  }
};
// Dessiner les portions de la mosaïque sur chaque canvas
const drawMosaicToCanvases = () => {
  if (!mosaicImg.value || !mosaicImg.value.complete) return;
  
  for (const camera of filteredCameras.value) {
    const canvas = cameraCanvases.value[camera.optionValue];
    const rect = cameraRects.value[camera.optionValue];
    
    if (canvas && rect) {
      const ctx = canvas.getContext('2d');
      try {
        // Dessiner la portion de l'image mosaïque
        ctx.drawImage(
          mosaicImg.value,
          rect.x, rect.y, rect.width, rect.height, // Source
          0, 0, canvas.width, canvas.height         // Destination
        );
      } catch (err) {
        console.error(`Failed to draw camera ${camera.optionValue}:`, err);
      }
    } else if (canvas && !rect) {
      // Si pas de rectangle trouvé, afficher un message
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Caméra ${camera.optionValue}`, canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillText('non trouvée dans mosaïque', canvas.width / 2, canvas.height / 2 + 10);
    }
  }
};

// Mettre à jour le stream d'une caméra en trouvant le bon clip
const updateCameraStream = async (cameraId) => {
  const canvas = cameraCanvases.value[cameraId];
  if (!canvas) return;
  
  // Si on est en mode live, la mosaïque gère tout
  if (isLive.value) {
    return; // Ne rien faire - startMosaicStream() gère le live
  }
  
  // Mode historique : charger l'image du clip à ce moment précis
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const targetTimestamp = Math.floor((dayStart.getTime() + currentTimeMs.value) / 1000);
  
  // Trouver le clip qui contient ce timestamp
  const clip = dayEvents.value.find(event => {
    if (event.camera !== cameraId) return false;
    const clipStart = event.date;
    const clipEnd = clipStart + (event.msec / 1000);
    return targetTimestamp >= clipStart && targetTimestamp <= clipEnd;
  });
  
  const ctx = canvas.getContext('2d');
  
  if (!clip) {
    // Pas de clip - afficher fond noir avec texte
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("Pas d'enregistrement", canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Calculer l'offset dans le clip (en ms)
  const offsetSeconds = targetTimestamp - clip.date;
  const offsetMs = Math.max(0, offsetSeconds * 1000);
  
  // Charger l'image depuis le clip à cette position
  const frameUrl = `/file/clips/${clip.path}?pos=${offsetMs}&session=${authStore.apiClient.session}&_t=${Date.now()}`;
  
  // Charger l'image et la dessiner sur le canvas
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.onerror = () => {
    // En cas d'erreur, afficher un message
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("Erreur de chargement", canvas.width / 2, canvas.height / 2);
  };
  img.src = frameUrl;
};

// Watchers
watch(selectedDate, () => {
  loadDayEvents();
});

// Mettre à jour seulement si on n'est pas en lecture (sinon c'est fait dans updatePlayback)
watch(cursorPosition, () => {
  // Mettre à jour automatiquement isLive basé sur la position du curseur
  const now = new Date();
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const cursorMs = dayStart.getTime() + currentTimeMs.value;
  const diffMs = now.getTime() - cursorMs;
  
  // Si aujourd'hui et proche de maintenant (< 5 secondes dans le futur, < 2 secondes dans le passé)
  const isToday = selectedDate.value === getLocalDateString();
  const wasLive = isLive.value;
  
  if (isToday && diffMs < 5000 && diffMs > -2000) {
    isLive.value = true;
  } else {
    isLive.value = false;
  }
  
  // Logger le changement de mode
  if (wasLive !== isLive.value) {
    console.log(`🔄 Mode changed: ${wasLive ? 'LIVE' : 'HISTORICAL'} → ${isLive.value ? 'LIVE' : 'HISTORICAL'}`);
  }
  
  // Mettre à jour la mosaïque seulement si en pause
  if (!isPlaying.value) {
    updateAllStreams();
  }
  
  // Mettre à jour le stream fullscreen SEULEMENT si en pause (seek manuel)
  // Pendant la lecture, le stream continue naturellement sans redémarrage
  if (fullscreenCamera.value && !isPlaying.value) {
    if (fullscreenSeekDebounceTimeout) {
      clearTimeout(fullscreenSeekDebounceTimeout);
    }
    fullscreenSeekDebounceTimeout = setTimeout(() => {
      console.log('🔄 Updating fullscreen stream at position:', formatCursorTime.value, '- Mode:', isLive.value ? 'LIVE' : 'HISTORICAL');
      startFullscreenStream();
    }, 300);
  }
});

watch(filteredCameras, () => {
  nextTick(() => {
    // Initialiser les dimensions des nouveaux canvas
    for (const camera of filteredCameras.value) {
      const canvas = cameraCanvases.value[camera.optionValue];
      if (canvas && (!canvas.width || canvas.width === 0)) {
        canvas.width = 320;
        canvas.height = 180;
      }
    }
    updateAllStreams();
  });
});

// Plein écran pour une caméra
const openFullscreenCamera = (cameraId) => {
  // Forcer la mise à jour du mode LIVE/HISTORICAL avant d'ouvrir
  const now = new Date();
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const cursorMs = dayStart.getTime() + currentTimeMs.value;
  const diffMs = now.getTime() - cursorMs;
  
  const isToday = selectedDate.value === getLocalDateString();
  
  if (isToday && diffMs < 5000 && diffMs > -2000) {
    isLive.value = true;
  } else {
    isLive.value = false;
  }
  
  console.log(`📸 Opening fullscreen for ${cameraId} - Mode: ${isLive.value ? 'LIVE' : 'HISTORICAL'}, diffMs: ${diffMs.toFixed(0)}`);
  
  fullscreenCamera.value = cameraId;
  nextTick(() => {
    startFullscreenStream();
  });
};

const closeFullscreenCamera = () => {
  stopFullscreenStream();
  fullscreenCamera.value = null;
};

const startFullscreenStream = async () => {
  stopFullscreenStream();
  
  if (!fullscreenCamera.value) return;
  
  const cameraId = fullscreenCamera.value;
  let streamUrl;
  
  if (isLive.value) {
    // Mode LIVE pour une caméra
    streamUrl = `/video/${cameraId}/2.0?session=${authStore.apiClient.session}&audio=0&stream=0&w=1920&h=1080&q=23&kbps=1000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&extend=2`;
    console.log('🔴 Fullscreen LIVE mode for', cameraId);
  } else {
    // Mode historique pour une caméra
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const posMs = dayStart.getTime() + currentTimeMs.value;
    streamUrl = `/time/${cameraId}?session=${authStore.apiClient.session}&pos=${posMs}&audio=0&stream=0&w=1920&h=1080&q=23&kbps=1000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&speed=${streamSpeed.value}&extend=2`;
    console.log('⏱️ Fullscreen HISTORICAL mode for', cameraId, 'at', formatCursorTime.value, '(pos:', posMs, ') - speed:', streamSpeed.value);
  }
  
  console.log('🎬 Starting fullscreen stream for', cameraId, ':', streamUrl);
  
  // Créer l'élément vidéo
  fullscreenVideo = document.getElementById('fullscreen-video');
  if (!fullscreenVideo) return;
  
  // Parser Blue Iris
  fullscreenParser = new BlueIrisParser(
    (frame) => {
      if (!fullscreenJmuxer) {
        fullscreenJmuxer = new JMuxer({
          node: fullscreenVideo,
          mode: 'video',
          videoCodec: frame.codec,
          debug: false,
          onReady: () => {
            fullscreenVideo.play().catch(err => console.error('❌ Fullscreen play error:', err));
          }
        });
      }
      fullscreenJmuxer.feed({ video: frame.frameData });
    },
    () => {},
    (bitmapHeader, audioHeader) => {
      console.log('📊 Fullscreen stream info:', bitmapHeader ? `${bitmapHeader.biWidth}x${bitmapHeader.biHeight}` : 'none');
    },
    () => {}
  );
  
  // Démarrer le fetch
  fullscreenAbortController = new AbortController();
  
  try {
    const response = await fetch(streamUrl, {
      signal: fullscreenAbortController.signal
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      fullscreenParser.write(value);
      fullscreenParser.parse();
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('❌ Fullscreen stream error:', error);
    }
  }
};

const stopFullscreenStream = () => {
  if (fullscreenSeekDebounceTimeout) {
    clearTimeout(fullscreenSeekDebounceTimeout);
    fullscreenSeekDebounceTimeout = null;
  }
  
  if (fullscreenAbortController) {
    fullscreenAbortController.abort();
    fullscreenAbortController = null;
  }
  
  if (fullscreenJmuxer) {
    fullscreenJmuxer.destroy();
    fullscreenJmuxer = null;
  }
  
  fullscreenParser = null;
};

// Lifecycle
onMounted(async () => {
  await camerasStore.fetchCameras();
  await loadDayEvents();
  
  // Initialiser les dimensions des canvas
  nextTick(() => {
    for (const camera of filteredCameras.value) {
      const canvas = cameraCanvases.value[camera.optionValue];
      if (canvas) {
        canvas.width = 320;
        canvas.height = 180;
      }
    }
    // Démarrer le stream et la lecture automatiquement
    updateAllStreams();
    startPlayback();
  });
});

onUnmounted(() => {
  // Cleanup playback
  stopPlayback();
  
  // Cleanup live updates
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
    liveUpdateInterval = null;
  }
  
  // Cleanup mosaic stream
  stopMosaicStream();
});
</script>

<style scoped>
.timeline-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.header h1 {
  font-size: 18px;
  margin: 0;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.date-input {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 14px;
}

.camera-filters {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  flex: 1;
}

.filter-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: var(--transition);
}

.filter-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-background);
}

.filter-btn:hover:not(.active) {
  background: var(--color-surface);
}

/* Grille de caméras */
.cameras-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  overflow-y: auto;
}

.camera-cell {
  position: relative;
  aspect-ratio: 16/9;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 2px solid var(--color-border);
  transition: var(--transition);
}

.camera-cell.inactive {
  opacity: 0.5;
  border-color: var(--color-border);
}

.camera-cell:not(.inactive) {
  border-color: var(--color-accent);
}

.camera-name {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
  color: white;
  font-size: 14px;
  font-weight: 500;
  z-index: 10;
}

.camera-canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Barre de timeline */
.timeline-bar {
  background: var(--color-surface);
  border-top: 2px solid var(--color-border);
  padding: var(--spacing-sm) var(--spacing-md);
  position: relative;
  z-index: 20;
}

/* Contrôles de lecture */
.playback-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.btn-live {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: var(--transition);
}

.btn-live svg {
  width: 16px;
  height: 16px;
}

.btn-live:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.btn-live.active {
  background: #e74c3c;
  border-color: #e74c3c;
  color: white;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.btn-play {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.btn-play:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.btn-play:active {
  transform: scale(0.95);
}

.btn-play svg {
  width: 20px;
  height: 20px;
}

.speed-controls {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.btn-speed {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  min-width: 42px;
  transition: var(--transition);
}

.btn-speed.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.btn-speed:hover:not(.active) {
  background: var(--color-background);
  border-color: var(--color-accent);
}

.zoom-controls {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  margin-left: var(--spacing-md);
  padding-left: var(--spacing-md);
  border-left: 1px solid var(--color-border);
}

.btn-zoom {
  padding: var(--spacing-xs);
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.btn-zoom:hover {
  background: var(--color-background);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.btn-zoom:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-zoom svg {
  width: 18px;
  height: 18px;
}

.zoom-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  min-width: 48px;
  text-align: center;
}

.timeline-hours {
  display: flex;
  position: relative;
  margin-bottom: var(--spacing-xs);
  font-size: 11px;
  color: var(--color-text-secondary);
  height: 18px;
}

.hour-marker {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}

.timeline-track {
  position: relative;
  height: 60px;
  background: var(--color-background);
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: visible;
}

.event-marker {
  position: absolute;
  top: 0;
  height: 60px;
  border-radius: 2px;
  transition: opacity 0.2s;
}

.event-marker:hover {
  opacity: 0.8;
}

.event-alert {
  background: rgba(239, 68, 68, 0.7);
}

.event-motion {
  background: rgba(59, 130, 246, 0.5);
}

.event-vehicle {
  background: rgba(239, 68, 68, 0.7);
}

.event-person {
  background: rgba(59, 130, 246, 0.7);
}

.timeline-cursor {
  position: absolute;
  top: -10px;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: none;
}

.cursor-handle {
  width: 20px;
  height: 80px;
  background: var(--color-accent);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  pointer-events: auto;
  cursor: ew-resize;
}

.cursor-time {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-accent);
  color: white;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Vue plein écran pour une caméra */
.fullscreen-camera {
  flex: 1;
  background: #000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
}

.fullscreen-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.btn-close {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.btn-close svg {
  width: 24px;
  height: 24px;
}

.fullscreen-video-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.fullscreen-video-container video {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}
</style>
