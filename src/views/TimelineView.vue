<template>
  <div class="timeline-view">
    <!-- Header compact -->
    <div class="header">
      <h1>{{ t('timeline.title') }}</h1>
      
      <!-- Navigation de date -->
      <div class="date-picker">
        <button @click="previousDay" class="btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <input
          v-model="selectedDate"
          type="date"
          class="input date-input"
        />
        
        <button @click="nextDay" class="btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
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
    <div class="cameras-grid">
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
          width="320"
          height="180"
        ></canvas>
      </div>
    </div>

    <!-- Barre de timeline au bas -->
    <div class="timeline-bar">
      <!-- Contrôles de lecture -->
      <div class="playback-controls">
        <button @click="togglePlayPause" class="btn-play" :title="isPlaying ? 'Pause' : 'Lecture'">
          <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span class="zoom-label">{{ zoomLevels[zoomLevel].label }}</span>
          <button @click="zoomIn" class="btn-zoom" title="Zoomer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
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

const { t } = useI18n();
const authStore = useAuthStore();
const camerasStore = useCamerasStore();

// État
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const dayEvents = ref([]);
const loading = ref(false);
const visibleCameras = ref(new Set());
const cameraCanvases = ref({});
const timelineTrack = ref(null);

// Initialiser le curseur à l'heure actuelle
const now = new Date();
const msFromMidnight = now.getHours() * 60 * 60 * 1000 + now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000;
const initialPosition = (msFromMidnight / (24 * 60 * 60 * 1000)) * 100;
const cursorPosition = ref(initialPosition);

const isDragging = ref(false);

// Contrôles de lecture
const isPlaying = ref(false);
const playbackSpeed = ref(1);
const playbackSpeeds = [1, 2, 5, 10, 20, 50];
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
  
  // Centrer sur la position du curseur
  const cursorMs = (cursorPosition.value / 100) * dayMs;
  let startMs = cursorMs - visibleMs / 2;
  let endMs = cursorMs + visibleMs / 2;
  
  // Ajuster si on dépasse les bornes
  if (startMs < 0) {
    endMs -= startMs;
    startMs = 0;
  }
  if (endMs > dayMs) {
    startMs -= (endMs - dayMs);
    endMs = dayMs;
  }
  startMs = Math.max(0, startMs);
  endMs = Math.min(dayMs, endMs);
  
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
    const pos = getEventPosition(event);
    return pos >= 0 && pos <= 100; // Exclure les événements hors de la vue
  });
});

// Temps actuel basé sur le curseur (en ms depuis minuit)
const currentTimeMs = computed(() => {
  return (cursorPosition.value / 100) * 24 * 60 * 60 * 1000;
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
  const date = new Date(selectedDate.value);
  date.setDate(date.getDate() - 1);
  selectedDate.value = date.toISOString().split('T')[0];
};

const nextDay = () => {
  const date = new Date(selectedDate.value);
  date.setDate(date.getDate() + 1);
  selectedDate.value = date.toISOString().split('T')[0];
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
    const dayStart = new Date(selectedDate.value);
    dayStart.setHours(0, 0, 0, 0);
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
  const dayStart = new Date(selectedDate.value);
  dayStart.setHours(0, 0, 0, 0);
  
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
  // Début de la journée en heure locale
  const dayStart = new Date(selectedDate.value);
  dayStart.setHours(0, 0, 0, 0);
  
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
const togglePlayPause = () => {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startPlayback();
  } else {
    stopPlayback();
  }
};

const setPlaybackSpeed = (speed) => {
  playbackSpeed.value = speed;
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
    
    // Convertir en pourcentage de la journée
    const dayMs = 24 * 60 * 60 * 1000;
    const deltaPercent = (progressMs / dayMs) * 100;
    
    cursorPosition.value += deltaPercent;
    
    // Boucler à la fin de la journée
    if (cursorPosition.value >= 100) {
      cursorPosition.value = 0;
    }
  }
  
  lastPlaybackTime = currentTime;
  playbackAnimationFrame = requestAnimationFrame(updatePlayback);
};

// Interaction avec la timeline
const seekToTime = (e) => {
  if (!timelineTrack.value) return;
  const rect = timelineTrack.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percentage = (x / rect.width) * 100;
  cursorPosition.value = Math.max(0, Math.min(100, percentage));
  updateAllStreams();
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

// Mise à jour de tous les streams à la position du curseur
const updateAllStreams = () => {
  for (const camera of filteredCameras.value) {
    updateCameraStream(camera.optionValue);
  }
};

// Mettre à jour le stream d'une caméra avec approche simplifiée
const updateCameraStream = async (cameraId) => {
  const canvas = cameraCanvases.value[cameraId];
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Calculer le timestamp Unix du moment visé (en secondes)
  const dayStart = new Date(selectedDate.value);
  dayStart.setHours(0, 0, 0, 0);
  const targetTimestamp = Math.floor((dayStart.getTime() + currentTimeMs.value) / 1000);
  
  // **SOLUTION SIMPLE** : Demander directement une frame à Blue Iris pour ce timestamp
  // Blue Iris sait lui-même quel clip (ou partie de clip) correspond à ce moment
  // On utilise l'API /image qui accepte un timestamp pour les enregistrements historiques
  
  // Format: /image/camera?time=timestamp&h=height&session=...
  const frameUrl = `/image/${encodeURIComponent(cameraId)}?time=${targetTimestamp}&h=180&cache=1&session=${authStore.apiClient.session}`;
  
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Retirer tout overlay - l'image est valide
  };
  img.onerror = () => {
    // Si erreur: soit la caméra n'avait pas de vidéo à ce moment, soit erreur réseau
    // Afficher un fond noir avec texte "Pas d'enregistrement"
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Pas d\'enregistrement', canvas.width / 2, canvas.height / 2);
  };
  img.src = frameUrl;
};

// Watchers
watch(selectedDate, () => {
  loadDayEvents();
});

watch(cursorPosition, () => {
  updateAllStreams();
});

watch(filteredCameras, () => {
  nextTick(() => {
    updateAllStreams();
  });
});

// Lifecycle
onMounted(async () => {
  await camerasStore.fetchCameras();
  await loadDayEvents();
  updateAllStreams();
});

onUnmounted(() => {
  // Cleanup playback
  stopPlayback();
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
}

/* Contrôles de lecture */
.playback-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
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
</style>
