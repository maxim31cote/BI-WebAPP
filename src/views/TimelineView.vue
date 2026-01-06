<template>
  <div class="timeline-view">
    <!-- Header compact -->
    <div class="header" v-if="!fullscreenCamera">
      <div class="header-top">
        <div class="header-left">
          <h1>{{ t('timeline.title') }}</h1>
        </div>
        
        <div class="header-right">
          <div class="system-info">
            <div class="info-item">
              <span class="info-label">CPU:</span>
              <span class="info-value">{{ serverStatus.cpu }}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">RAM:</span>
              <span class="info-value">{{ serverStatus.mem }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">GPU:</span>
              <span class="info-value">{{ serverStatus.gpu }}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">FPS:</span>
              <span class="info-value">{{ serverStatus.fps }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="header-bottom">
        <div class="header-controls">
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
              :max="getLocalDateString()"
            >
            
            <button @click="nextDay" class="btn-icon" :disabled="selectedDate >= getLocalDateString()">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>

          <!-- Bouton édition -->
          <button @click="toggleEditMode" class="btn-edit" :class="{ active: editMode }">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {{ editMode ? 'Terminer' : 'Édition' }}
          </button>
        </div>

        <!-- Filtres de caméras -->
        <div class="camera-filters">
          <button @click="showAllCameras" class="filter-btn" :class="{ active: visibleCameras.size === 0 }">
            Toutes
          </button>
          <button 
            v-for="camera in availableCamerasForFilter" 
            :key="camera.optionValue"
            @click="toggleCamera(camera.optionValue)"
            class="filter-btn"
            :class="{ active: visibleCameras.size === 0 || visibleCameras.has(camera.optionValue) }"
          >
            {{ camera.optionDisplay }}
          </button>
        </div>
      </div>
    </div>

    <!-- Grille de caméras -->
    <div 
      class="cameras-grid" 
      v-if="!fullscreenCamera" 
      :class="{ 
        'edit-mode': editMode, 
        'compact-edit': editMode && isMobile,
        'single-camera': filteredCameras.length === 1,
        'dual-camera': filteredCameras.length === 2
      }"
      :style="gridStyle"
    >
      <div
        v-for="(camera, index) in filteredCameras"
        :key="camera.optionValue"
        class="camera-cell"
        :class="{ 
          inactive: !isCameraActiveAtTime(camera.optionValue), 
          draggable: editMode,
          hidden: hiddenCameras.includes(camera.optionValue),
          'compact-edit-cell': editMode && isMobile
        }"
        :draggable="editMode"
        @dragstart="handleDragStart($event, index)"
        @dragover="handleDragOver($event, index)"
        @drop="handleDrop($event, index)"
        @dragend="handleDragEnd"
      >
        <div class="camera-name" :class="{ 'compact-name': editMode && isMobile }">
          <svg 
            v-if="editMode" 
            class="drag-handle" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            @touchstart.stop="isMobile && handleTouchStart($event, index)"
            @touchmove.prevent="isMobile && handleTouchMove($event, index)"
            @touchend="isMobile && handleTouchEnd($event, index)"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
          </svg>
          {{ camera.optionDisplay }}
        </div>
        <!-- Indicateur d'enregistrement -->
        <div 
          v-if="isLive"
          class="recording-indicator"
          :class="{ 
            'manual-recording': isCameraManualRecording(camera.optionValue),
            'auto-recording': isCameraRecording(camera.optionValue) && !isCameraManualRecording(camera.optionValue),
            'not-recording': !isCameraRecording(camera.optionValue)
          }"
          :title="isCameraRecording(camera.optionValue) 
            ? (isCameraManualRecording(camera.optionValue) ? 'Enregistrement manuel - Cliquer pour arrêter' : 'Enregistrement automatique')
            : 'Non enregistré - Cliquer pour démarrer'"
          @click.stop="!editMode && !isCameraRecording(camera.optionValue) ? toggleManualRecording(camera.optionValue) : isCameraManualRecording(camera.optionValue) ? toggleManualRecording(camera.optionValue) : null"
        >
          <div class="recording-dot"></div>
        </div>
        <!-- Indicateur de déclenchement -->
        <div 
          v-if="isLive && isCameraTriggered(camera.optionValue)" 
          class="triggered-indicator"
          title="Alerte déclenchée"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
          </svg>
        </div>
        <button 
          v-if="editMode" 
          @click.stop="toggleCameraVisibility(camera.optionValue)"
          class="btn-toggle-visibility"
          :class="{ hidden: hiddenCameras.includes(camera.optionValue) }"
        >
          <svg v-if="!hiddenCameras.includes(camera.optionValue)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </button>
        <canvas
          v-if="!(editMode && isMobile)"
          :ref="el => cameraCanvases[camera.optionValue] = el"
          class="camera-canvas"
          @click="!editMode && openFullscreenCamera(camera.optionValue)"
          :style="{ cursor: editMode ? 'move' : 'pointer' }"
        />
      </div>
    </div>

    <!-- Vue plein écran pour une caméra -->
    <div class="fullscreen-camera" v-if="fullscreenCamera">
      <div class="fullscreen-header" :class="{ 'header-hidden': !showTimelineBar }" @touchstart.stop>
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

      <!-- Contrôles PTZ pour caméras compatibles en mode LIVE -->
      <div v-if="isLive && fullscreenCameraHasPTZ" class="ptz-controls">
        <button @click="togglePTZ" class="btn-ptz-toggle" title="Contrôles PTZ">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        </button>

        <div v-show="showPTZ" class="ptz-overlay">
          <div class="ptz-dpad">
            <button @click="ptzCommand('up')" class="ptz-btn ptz-up">▲</button>
            <button @click="ptzCommand('left')" class="ptz-btn ptz-left">◄</button>
            <button @click="ptzCommand('home')" class="ptz-btn ptz-center">⌂</button>
            <button @click="ptzCommand('right')" class="ptz-btn ptz-right">►</button>
            <button @click="ptzCommand('down')" class="ptz-btn ptz-down">▼</button>
          </div>
          <div class="ptz-zoom">
            <button @click="ptzCommand('zoomin')" class="ptz-btn">+</button>
            <button @click="ptzCommand('zoomout')" class="ptz-btn">−</button>
          </div>
          <div class="ptz-presets">
            <button @click="ptzCommand('preset1')" class="ptz-btn ptz-preset" title="Position 1">1</button>
            <button @click="ptzCommand('preset2')" class="ptz-btn ptz-preset" title="Position 2">2</button>
            <button @click="ptzCommand('preset3')" class="ptz-btn ptz-preset" title="Position 3">3</button>
            <button @click="ptzCommand('preset4')" class="ptz-btn ptz-preset" title="Position 4">4</button>
            <button @click="ptzCommand('preset5')" class="ptz-btn ptz-preset" title="Position 5">5</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Barre de timeline au bas -->
    <div class="timeline-bar" v-if="!editMode" :class="{ 'timeline-hidden': fullscreenCamera && !showTimelineBar }" @touchstart.stop>
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
        
        <button @click="toggleAudio" class="btn-audio" :class="{ active: audioEnabled }" :title="audioEnabled ? 'Désactiver le son' : 'Activer le son'">
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
        
        <div class="speed-controls" v-if="!isLive">
          <label for="speed-select" class="speed-label">Vitesse:</label>
          <select id="speed-select" v-model="playbackSpeed" @change="setPlaybackSpeed(playbackSpeed)" class="speed-select">
            <option v-for="speed in playbackSpeeds" :key="speed" :value="speed">{{ speed }}x</option>
          </select>
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
      
      <div class="timeline-hours" ref="timelineHoursRef">
        <span 
          v-for="marker in visibleHourMarkers" 
          :key="marker.key" 
          class="hour-marker"
          :style="{ left: marker.position + '%' }"
        >
          {{ marker.minute > 0 ? `${String(marker.hour).padStart(2, '0')}:${String(marker.minute).padStart(2, '0')}` : `${String(marker.hour).padStart(2, '0')}:00` }}
        </span>
        
        <!-- Affichage de l'heure du curseur -->
        <div class="cursor-time-display" :style="{ left: cursorDisplayPosition + '%' }">
          {{ formatCursorTime }}
        </div>
      </div>
      
      <!-- Zone d'icônes de détection -->
      <div class="detection-icons-zone">
        <div
          v-for="event in visibleEventsWithIcons"
          :key="event.path"
          class="detection-icon-marker"
          :class="'detection-' + event.detectionType"
          :style="{ left: getEventPosition(event) + '%' }"
          :title="getDetectionTooltip(event)"
          @click="seekToEvent(event, $event)"
        >
          <!-- Icône personne -->
          <svg v-if="event.detectionType === 'person'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <!-- Icône véhicule -->
          <svg v-else-if="event.detectionType === 'vehicle'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0h-.01M15 17a2 2 0 104 0m-4 0h-.01M13 6h3l4 4" />
          </svg>
          <!-- Icône animal -->
          <svg v-else-if="event.detectionType === 'animal'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      
      <div class="timeline-track" ref="timelineTrack" @click="seekToTime" @mousedown="startDrag" @touchstart="startDrag">
        <!-- Événements visualisés (uniquement ceux dans la plage visible) -->
        <div
          v-for="event in visibleEvents"
          :key="event.path"
          class="event-marker"
          :class="getEventClass(event)"
          :style="{ left: getEventPosition(event) + '%', width: getEventWidth(event) + '%' }"
          :title="`${event.camera} - ${event.memo || 'Motion'}`"
        ></div>
        
        <!-- Zone future (non accessible) -->
        <div 
          v-if="futureZonePosition !== null" 
          class="future-zone" 
          :style="{ left: futureZonePosition + '%', width: (100 - futureZonePosition) + '%' }"
        ></div>
        
        <!-- Curseur de position -->
        <div class="timeline-cursor" :style="{ left: cursorDisplayPosition + '%' }" v-show="cursorDisplayPosition >= 0">
          <div class="cursor-handle"></div>
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
import { useFullscreen } from '../composables/useFullscreen';
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
// Date dérivée du timestamp du viewport
const selectedDate = computed({
  get: () => {
    const date = new Date(viewportCenterTimestamp.value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  set: (newDate) => {
    // Quand on change la date, garder l'heure actuelle du viewport
    const currentDate = new Date(viewportCenterTimestamp.value);
    const [year, month, day] = newDate.split('-').map(Number);
    const newTimestamp = new Date(
      year,
      month - 1,
      day,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    ).getTime();
    viewportCenterTimestamp.value = newTimestamp;
  }
});
const dayEvents = ref([]);
const availableVideoClips = ref([]); // Clips complets pour savoir quelles caméras ont de la vidéo
const loading = ref(false);
const visibleCameras = ref(new Set());
const cameraCanvases = ref({});
const timelineTrack = ref(null);
const showTimelineBar = ref(true); // Contrôle de l'affichage de la timeline
const audioEnabled = ref(false); // Contrôle du son
const audioVolume = ref(0.8); // Volume audio (0.0 à 1.0)
// Mode édition désormais partagé via composable useFullscreen (isEditMode)
const hiddenCameras = ref([]); // Caméras masquées (IDs)
const showPTZ = ref(false); // Affichage des contrôles PTZ
let draggedIndex = null;
let isCameraDragging = false;
let autoScrollInterval = null;
let lastDragY = 0;
let touchStartY = 0;
let draggedElement = null;
let placeholder = null;

// Initialiser le curseur à l'heure actuelle en mode LIVE
const getCurrentTimestamp = () => {
  // Utiliser l'heure locale, pas UTC
  const now = new Date();
  return now.getTime();
};

// Position du viewport en timestamp absolu (ms depuis epoch)
const viewportCenterTimestamp = ref(getCurrentTimestamp());

const isDragging = ref(false);
let dragStartRange = null; // Plage visible capturée au début du drag
let dragStartX = null; // Position X initiale du touch/mouse
let dragStartTimestamp = null; // Timestamp initial du viewport
let dragStartDate = null; // Date initiale pour compenser les changements pendant le drag
let hasMoved = false; // Pour distinguer tap vs drag
let justFinishedDrag = false; // Pour ignorer le click après un drag
let manualSeek = false; // Flag pour désactiver la réactivation auto du mode live

// Mode plein écran pour une caméra
// Utiliser le composable partagé pour l'état fullscreen et editMode
const { fullscreenCamera, isEditMode } = useFullscreen(); // ID de la caméra en plein écran
let fullscreenVideo = null;
let fullscreenJmuxer = null;
let fullscreenParser = null;
let fullscreenAbortController = null;

// Infos système
const serverStatus = ref({
  cpu: 0,
  mem: 0,
  gpu: 0,
  fps: 0
});
const cameraStatus = ref({}); // Statut de chaque caméra (isRecording, isTriggered, etc.)
let statusUpdateInterval = null;

// Suivi des FPS par caméra
const cameraFrameTimes = ref({});
const cameraFPS = ref({});

// Créer un computed local editMode qui référence isEditMode du composable
// Pour compatibilité avec le template
const editMode = computed({
  get: () => isEditMode.value,
  set: (value) => { isEditMode.value = value; }
});

const updateServerStatus = async () => {
  const result = await authStore.apiClient.getStatus();
  if (result.success && result.status) {
    serverStatus.value = {
      cpu: result.status.cpu || 0,
      mem: result.status.mem || 0,
      gpu: result.status.gpu || 0,
      fps: serverStatus.value.fps // Garder les FPS calculés localement
    };
  }
  
  // Récupérer le statut des caméras avec camlist
  const camerasResult = await authStore.apiClient.getCameras();
  if (camerasResult.success && camerasResult.cameras) {
    const newCameraStatus = {};
    
    camerasResult.cameras.forEach(cam => {
      if (cam.optionValue) {
        newCameraStatus[cam.optionValue] = {
          isRecording: cam.isRecording === true || cam.isRecording === 1,
          isManRec: cam.isManRec === true || cam.isManRec === 1,
          isTriggered: cam.isTriggered === true || cam.isTriggered === 1,
          isEnabled: cam.isEnabled !== false
        };
      }
    });
    
    cameraStatus.value = newCameraStatus;
  }
};

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
// Initialiser à 6h sur mobile (index 2), 24h sur desktop (index 0)
const zoomLevel = ref(window.innerWidth <= 768 ? 2 : 0);
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
  
  // Le viewport est centré sur viewportCenterTimestamp
  const centerMs = viewportCenterTimestamp.value;
  let startMs = centerMs - visibleMs / 2;
  let endMs = centerMs + visibleMs / 2;
  
  return { startMs, endMs, durationMs: endMs - startMs };
});

// Détection mobile
const isMobile = computed(() => {
  return window.innerWidth <= 768;
});

// Référence pour le conteneur des heures (pour le scroll automatique)
const timelineHoursRef = ref(null);

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
  
  const dayMs = 24 * 60 * 60 * 1000;
  let currentMs = Math.floor(range.startMs / interval) * interval;
  
  while (currentMs <= range.endMs) {
    if (currentMs >= range.startMs) {
      // Convertir le timestamp en date locale pour obtenir l'heure
      const date = new Date(currentMs);
      const hour = date.getHours();
      const minute = date.getMinutes();
      const position = ((currentMs - range.startMs) / range.durationMs) * 100;
      
      // Créer une clé stable pour éviter les re-renders
      const key = `${currentMs}-${hour}-${minute}`;
      
      markers.push({
        hour: hour,
        minute: minute,
        position: Math.round(position * 1000) / 1000, // Arrondir à 3 décimales
        key: key
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

// Caméras disponibles pour les boutons de filtre (exclure les caméras masquées et trier selon l'ordre)
const availableCamerasForFilter = computed(() => {
  const filtered = availableCameras.value.filter(cam => !hiddenCameras.value.includes(cam.optionValue));
  
  // Trier selon l'ordre personnalisé
  if (cameraOrder.value.length > 0) {
    return filtered.sort((a, b) => {
      const indexA = cameraOrder.value.indexOf(a.optionValue);
      const indexB = cameraOrder.value.indexOf(b.optionValue);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }
  
  return filtered;
});

// Vérifier si la caméra en plein écran a le PTZ
const fullscreenCameraHasPTZ = computed(() => {
  if (!fullscreenCamera.value) return false;
  const camera = availableCameras.value.find(c => c.optionValue === fullscreenCamera.value);
  return camera?.ptz === true;
});

// Ordre personnalisé des caméras (sauvegardé dans localStorage)
const cameraOrder = ref([]);

// Charger l'ordre des caméras depuis localStorage
const loadCameraOrder = () => {
  const userId = authStore.user?.username || 'default';
  const saved = localStorage.getItem(`cameraOrder_${userId}`);
  if (saved) {
    try {
      cameraOrder.value = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading camera order:', e);
      cameraOrder.value = [];
    }
  }
};

// Sauvegarder l'ordre des caméras dans localStorage
const saveCameraOrder = () => {
  const userId = authStore.user?.username || 'default';
  localStorage.setItem(`cameraOrder_${userId}`, JSON.stringify(cameraOrder.value));
};

// Charger les caméras masquées depuis localStorage
const loadHiddenCameras = () => {
  const userId = authStore.user?.username || 'default';
  const saved = localStorage.getItem(`hiddenCameras_${userId}`);
  if (saved) {
    try {
      hiddenCameras.value = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading hidden cameras:', e);
      hiddenCameras.value = [];
    }
  }
};

// Sauvegarder les caméras masquées dans localStorage
const saveHiddenCameras = () => {
  const userId = authStore.user?.username || 'default';
  localStorage.setItem(`hiddenCameras_${userId}`, JSON.stringify(hiddenCameras.value));
};

// Basculer la visibilité d'une caméra
const toggleCameraVisibility = (cameraId) => {
  const index = hiddenCameras.value.indexOf(cameraId);
  if (index > -1) {
    hiddenCameras.value.splice(index, 1);
  } else {
    hiddenCameras.value.push(cameraId);
    
    // En mode édition mobile, déplacer la caméra masquée en bas
    if (editMode.value && isMobile.value) {
      const orderIndex = cameraOrder.value.indexOf(cameraId);
      if (orderIndex > -1) {
        cameraOrder.value.splice(orderIndex, 1);
        cameraOrder.value.push(cameraId);
        saveCameraOrder();
      }
    }
  }
  saveHiddenCameras();
};

// Charger la sélection des caméras depuis localStorage
const loadSelectedCameras = () => {
  const userId = authStore.user?.username || 'default';
  const saved = localStorage.getItem(`timeline-selected-cameras_${userId}`);
  if (saved) {
    try {
      const selected = JSON.parse(saved);
      visibleCameras.value = new Set(selected);
    } catch (e) {
      console.error('Error loading selected cameras:', e);
      visibleCameras.value = new Set();
    }
  }
};

// Sauvegarder la sélection des caméras dans localStorage
const saveSelectedCameras = () => {
  const userId = authStore.user?.username || 'default';
  const selected = Array.from(visibleCameras.value);
  localStorage.setItem(`timeline-selected-cameras_${userId}`, JSON.stringify(selected));
};

// Caméras filtrées pour affichage
const filteredCameras = computed(() => {
  let cameras = visibleCameras.value.size === 0 
    ? availableCameras.value 
    : availableCameras.value.filter(cam => visibleCameras.value.has(cam.optionValue));
  
  // En mode mobile et mode historique, masquer les caméras sans vidéo disponible
  if (isMobile.value && !isLive.value) {
    cameras = cameras.filter(cam => hasVideoAvailable(cam.optionValue));
  }
  
  // Filtrer les caméras masquées (sauf en mode édition)
  if (!editMode.value) {
    cameras = cameras.filter(cam => !hiddenCameras.value.includes(cam.optionValue));
  }
  
  // Appliquer l'ordre personnalisé si disponible
  if (cameraOrder.value.length > 0) {
    cameras = cameras.sort((a, b) => {
      const indexA = cameraOrder.value.indexOf(a.optionValue);
      const indexB = cameraOrder.value.indexOf(b.optionValue);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }
  
  // En mode édition mobile, trier les caméras masquées en bas
  if (editMode.value && isMobile.value) {
    const visible = cameras.filter(cam => !hiddenCameras.value.includes(cam.optionValue));
    const hidden = cameras.filter(cam => hiddenCameras.value.includes(cam.optionValue));
    return [...visible, ...hidden];
  }
  
  return cameras;
});

// Style dynamique de la grille pour ajuster la taille selon le nombre de caméras
const gridStyle = computed(() => {
  // Ne pas appliquer en mode édition compact mobile
  if (editMode.value && isMobile.value) {
    return {};
  }
  
  const cameraCount = filteredCameras.value.length;
  
  // Pas de caméras
  if (cameraCount === 0) return {};
  
  // 1 caméra : prendre le maximum d'espace
  if (cameraCount === 1) {
    return {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr',
      maxWidth: isMobile.value ? '100%' : '95vw',
      width: '100%',
      height: 'calc(100vh - 200px - 170px)', // Hauteur de la fenêtre moins header et timeline
      padding: 'var(--spacing-md)',
      margin: '0 auto',
      alignItems: 'center',
      justifyItems: 'center'
    };
  }
  
  // 2 caméras : 2 colonnes sur desktop, 1 sur mobile
  if (cameraCount === 2) {
    return {
      gridTemplateColumns: isMobile.value ? '1fr' : 'repeat(2, 1fr)',
      maxWidth: '95vw',
      margin: '0 auto'
    };
  }
  
  // 3-4 caméras : grille 2x2
  if (cameraCount <= 4) {
    return {
      gridTemplateColumns: isMobile.value ? '1fr' : 'repeat(2, 1fr)',
      gridTemplateRows: isMobile.value ? `repeat(${cameraCount}, 1fr)` : 'repeat(2, 1fr)',
      maxWidth: isMobile.value ? '100%' : '95vw',
      width: '100%',
      height: 'calc(100vh - 200px - 170px)',
      margin: '0 auto',
      gap: isMobile.value ? 'var(--spacing-sm)' : 'var(--spacing-xs)',
      placeItems: 'stretch'
    };
  }
  
  // 5-6 caméras : grille 3x2 sur desktop
  if (cameraCount <= 6) {
    return {
      gridTemplateColumns: isMobile.value ? '1fr' : 'repeat(3, 1fr)',
      gridTemplateRows: isMobile.value ? `repeat(${cameraCount}, 1fr)` : 'repeat(2, 1fr)',
      maxWidth: isMobile.value ? '100%' : '95vw',
      width: '100%',
      height: 'calc(100vh - 200px - 170px)',
      margin: '0 auto',
      gap: isMobile.value ? 'var(--spacing-sm)' : 'var(--spacing-xs)',
      placeItems: 'stretch'
    };
  }
  
  // Plus de 6 caméras : layout auto-fit normal
  return {};
});

// Événements visibles dans la plage de zoom actuelle
const visibleEvents = computed(() => {
  return dayEvents.value.filter(event => {
    // Exclure les événements des caméras masquées
    if (hiddenCameras.value.includes(event.camera)) {
      return false;
    }
    
    // Si une caméra est en plein écran, afficher seulement ses événements
    if (fullscreenCamera.value && event.camera !== fullscreenCamera.value) {
      return false;
    }
    
    const pos = getEventPosition(event);
    return pos >= 0 && pos <= 100; // Exclure les événements hors de la vue
  });
});

// Événements avec icônes (détection de type pour affichage)
const visibleEventsWithIcons = computed(() => {
  const eventsWithType = [];
  const seenPaths = new Set();
  
  dayEvents.value.forEach(event => {
    // Exclure les événements des caméras masquées
    if (hiddenCameras.value.includes(event.camera)) {
      return;
    }
    
    // Si une caméra est en plein écran, afficher seulement ses événements
    if (fullscreenCamera.value && event.camera !== fullscreenCamera.value) {
      return;
    }
    
    // Détecter le type d'événement
    let type = null;
    
    if (event.memo) {
      const memoLower = event.memo.toLowerCase();
      
      if (memoLower.includes('person') || memoLower.includes('people') || 
          memoLower.includes('human') || memoLower.includes('man') || memoLower.includes('woman')) {
        type = 'person';
      } else if (memoLower.includes('car') || memoLower.includes('vehicle') || 
                 memoLower.includes('truck') || memoLower.includes('bus') ||
                 memoLower.includes('motorcycle') || memoLower.includes('bicycle')) {
        type = 'vehicle';
      } else if (memoLower.includes('dog') || memoLower.includes('cat') || 
                 memoLower.includes('bird') || memoLower.includes('horse') || memoLower.includes('animal')) {
        type = 'animal';
      }
    }
    
    // Ajouter seulement si on a détecté un type et pas déjà vu
    if (type && !seenPaths.has(event.path)) {
      seenPaths.add(event.path);
      eventsWithType.push({
        ...event,
        detectionType: type
      });
    }
  });
  
  return eventsWithType;
});

// Obtenir le tooltip pour une icône de détection
const getDetectionTooltip = (event) => {
  const time = new Date(event.date * 1000).toLocaleTimeString();
  const typeLabels = {
    person: 'Personne détectée',
    vehicle: 'Véhicule détecté',
    animal: 'Animal détecté'
  };
  return `${event.camera} - ${time} - ${typeLabels[event.detectionType] || ''}`;
};

// Aller au début d'un événement (clic sur icône)
const seekToEvent = (event, e) => {
  // Empêcher la propagation pour ne pas déclencher le clic sur la timeline
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  
  // Marquer comme seek manuel pour éviter l'interférence du watch
  manualSeek = true;
  
  // Désactiver le mode live si actif
  if (isLive.value) {
    isLive.value = false;
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
  }
  
  // Positionner le viewport au début de l'événement
  const eventTimestamp = event.date * 1000; // Convertir en ms
  viewportCenterTimestamp.value = eventTimestamp;
  
  // Mettre à jour tous les streams
  updateAllStreams(true);
  
  // Mettre à jour le fullscreen aussi si ouvert - IMPORTANT: arrêter puis redémarrer
  if (fullscreenCamera.value) {
    // Ne pas appeler stopFullscreenStream ici car startFullscreenStream le fait déjà
    setTimeout(() => {
      console.log('🔄 Restarting fullscreen after icon click at position:', new Date(eventTimestamp).toLocaleTimeString());
      startFullscreenStream(); // Créer un nouveau stream (qui appelle déjà stopFullscreenStream)
      // Réinitialiser manualSeek après
      setTimeout(() => { manualSeek = false; }, 200);
    }, 200); // Augmenter encore le délai
  } else {
    // Pas de fullscreen, réinitialiser manualSeek immédiatement
    setTimeout(() => { manualSeek = false; }, 100);
  }
};

// Temps actuel basé sur le curseur (en ms depuis minuit)
const currentTimeMs = computed(() => {
  // Le curseur est maintenant toujours au centre du viewport
  // Retourne les ms dans la journ\u00e9e (0-86400000)
  const date = new Date(viewportCenterTimestamp.value);
  const ms = date.getHours() * 60 * 60 * 1000 +
             date.getMinutes() * 60 * 1000 +
             date.getSeconds() * 1000 +
             date.getMilliseconds();
  return ms;
});

// Position d'affichage du curseur (relative à la plage visible)
const cursorDisplayPosition = computed(() => {
  // Le curseur est TOUJOURS au centre de la vue (50%)
  return 50;
});

// Position de la zone future (non accessible) dans la timeline
const futureZonePosition = computed(() => {
  const now = Date.now();
  const range = visibleRange.value;
  
  // Si la zone visible ne contient pas de futur, pas besoin d'afficher
  if (now < range.startMs) {
    return null; // Tout est dans le passé
  }
  
  if (now > range.endMs) {
    return null; // Tout est déjà passé
  }
  
  // Calculer la position du "maintenant" dans la timeline visible
  const position = ((now - range.startMs) / range.durationMs) * 100;
  return Math.max(0, Math.min(100, position));
});

// Formattage du temps du curseur
const formatCursorTime = computed(() => {
  const ms = Math.max(0, currentTimeMs.value); // S'assurer que ms est toujours >= 0
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
  saveSelectedCameras();
};

const toggleCamera = (cameraId) => {
  if (visibleCameras.value.has(cameraId)) {
    visibleCameras.value.delete(cameraId);
  } else {
    visibleCameras.value.add(cameraId);
  }
  saveSelectedCameras();
};

// Charger les événements de la journée (alertes + enregistrements continus)
const loadDayEvents = async () => {
  loading.value = true;
  
  try {
    // Utiliser le début de la journée en heure locale
    // IMPORTANT: Parser manuellement pour éviter les problèmes de fuseau horaire
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    // Charger aussi le jour précédent et suivant pour éviter les trous
    const prevDayStart = new Date(dayStart);
    prevDayStart.setDate(prevDayStart.getDate() - 1);
    const nextDayStart = new Date(dayStart);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    const nextDayEnd = new Date(nextDayStart);
    nextDayEnd.setDate(nextDayEnd.getDate() + 1);
    
    const startTimestamp = Math.floor(prevDayStart.getTime() / 1000); // Commence hier
    const endTimestamp = Math.floor(nextDayEnd.getTime() / 1000);     // Termine demain
    
    console.log(`📅 Loading events from ${prevDayStart.toLocaleDateString()} to ${nextDayEnd.toLocaleDateString()}`);
    
    // Charger les alertes ET les clips complets en parallèle
    // Alertes: pour la timeline et les icônes de détection
    // Clips: pour savoir quelles caméras ont de la vidéo disponible
    const [alertResult, clipResult] = await Promise.all([
      authStore.apiClient.getClips('alertlist', 'all', 'index', startTimestamp, endTimestamp),
      authStore.apiClient.getClips('cliplist', 'all', 'index', startTimestamp, endTimestamp)
    ]);
    
    // Stocker les clips complets séparément (pour savoir quelles caméras ont de la vidéo)
    if (clipResult.success && clipResult.clips) {
      availableVideoClips.value = clipResult.clips;
    } else {
      availableVideoClips.value = [];
    }
    
    // Utiliser uniquement les alertes pour la timeline
    const allClips = [];
    
    if (alertResult.success && alertResult.clips) {
      allClips.push(...alertResult.clips);
    }
    
    // Trier par date
    allClips.sort((a, b) => a.date - b.date);
    
    dayEvents.value = allClips;
    
    // Log détaillé pour debug
    console.log(`📅 Loaded ${dayEvents.value.length} alerts for 3 days (${prevDayStart.toLocaleDateString()} - ${nextDayEnd.toLocaleDateString()})`);
    
    // Analyser la couverture par caméra
    const cameraStats = {};
    dayEvents.value.forEach(clip => {
      if (!cameraStats[clip.camera]) {
        cameraStats[clip.camera] = { count: 0, totalDuration: 0 };
      }
      cameraStats[clip.camera].count++;
      cameraStats[clip.camera].totalDuration += (clip.msec / 1000);
    });
    
    console.log('📊 Couverture par caméra (alertes uniquement):');
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
  const eventTimestamp = event.date * 1000; // Convertir en ms
  
  const range = visibleRange.value;
  
  // Vérifier si l'événement est dans la plage visible
  if (eventTimestamp < range.startMs || eventTimestamp > range.endMs) {
    return -100; // Hors de la vue
  }
  
  return ((eventTimestamp - range.startMs) / range.durationMs) * 100;
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

// Vérifier si une caméra a de la vidéo disponible (enregistrements continus)
const hasVideoAvailable = (cameraId) => {
  // En mode LIVE, toutes les caméras sont considérées disponibles
  if (isLive.value) {
    return true;
  }
  
  // Vérifier si la caméra a des clips vidéo (enregistrements continus) pour la période chargée
  return availableVideoClips.value.some(clip => clip.camera === cameraId);
};

// Vérifier si une caméra a de la vidéo au temps actuel (alertes)
const isCameraActiveAtTime = (cameraId) => {
  // En mode LIVE, toutes les caméras streamées sont actives
  if (isLive.value) {
    return true;
  }
  
  // Utiliser directement viewportCenterTimestamp (déjà en ms epoch)
  const targetTime = viewportCenterTimestamp.value;
  const targetTimestamp = targetTime / 1000;
  
  // Chercher si un événement existe pour cette caméra à ce moment
  return dayEvents.value.some(event => {
    if (event.camera !== cameraId) return false;
    const eventStart = event.date;
    const eventEnd = eventStart + (event.msec / 1000);
    return targetTimestamp >= eventStart && targetTimestamp <= eventEnd;
  });
};

// Vérifier si une caméra est en train d'enregistrer
const isCameraRecording = (cameraId) => {
  return cameraStatus.value[cameraId]?.isRecording || false;
};

// Vérifier si une caméra est en enregistrement manuel
const isCameraManualRecording = (cameraId) => {
  return cameraStatus.value[cameraId]?.isManRec || false;
};

// Vérifier si une caméra est déclenchée (triggered)
const isCameraTriggered = (cameraId) => {
  return cameraStatus.value[cameraId]?.isTriggered || false;
};

// Basculer l'enregistrement manuel d'une caméra
const toggleManualRecording = async (cameraId) => {
  const isCurrentlyRecording = isCameraManualRecording(cameraId);
  const result = await authStore.apiClient.setManualRecording(cameraId, !isCurrentlyRecording);
  
  if (result.success) {
    // Mettre à jour immédiatement le statut local
    if (cameraStatus.value[cameraId]) {
      cameraStatus.value[cameraId].isManRec = !isCurrentlyRecording;
      cameraStatus.value[cameraId].isRecording = !isCurrentlyRecording;
    }
    // Rafraîchir le statut complet après un court délai
    setTimeout(updateServerStatus, 500);
  }
};

// Contrôles PTZ
const togglePTZ = () => {
  showPTZ.value = !showPTZ.value;
};

const ptzCommand = async (command) => {
  if (!fullscreenCamera.value) return;
  
  // Mapper les commandes aux codes Blue Iris (corrigé selon le comportement réel)
  const buttonMap = {
    'up': 2,      // Monter (gauche fait monter)
    'down': 3,    // Descendre (droite fait descendre)
    'left': 0,    // Gauche (haut tourne à gauche)
    'right': 1,   // Droite (bas devrait être droite)
    'home': 4,    // Centre/Home
    'zoomin': 5,  // Zoom +
    'zoomout': 6, // Zoom -
    'preset1': 101, // Position pré-enregistrée 1
    'preset2': 102, // Position pré-enregistrée 2
    'preset3': 103, // Position pré-enregistrée 3
    'preset4': 104, // Position pré-enregistrée 4
    'preset5': 105  // Position pré-enregistrée 5
  };
  
  const buttonCode = buttonMap[command] !== undefined ? buttonMap[command] : command;
  
  console.log('🎮 PTZ Command:', command, '→ Code:', buttonCode, 'Camera:', fullscreenCamera.value);
  
  try {
    const response = await authStore.apiClient.client.post('/json', {
      cmd: 'ptz',
      camera: fullscreenCamera.value,
      button: buttonCode,
      session: authStore.apiClient.session
    });
    
    console.log('📡 PTZ Response:', response.data);
    
    if (response.data.result !== 'success') {
      console.error('❌ PTZ command failed:', command, response.data);
    }
  } catch (error) {
    console.error('❌ PTZ error:', error);
  }
};

// Contrôles de zoom
const zoomIn = () => {
  if (zoomLevel.value < zoomLevels.length - 1) {
    zoomLevel.value++;
  }
};

const zoomOut = () => {
  // Sur mobile, minimum 6h (index 2)
  // Sur desktop, minimum 24h (index 0)
  const minZoomLevel = isMobile.value ? 2 : 0;
  if (zoomLevel.value > minZoomLevel) {
    zoomLevel.value--;
  }
};

// Contrôles de lecture
const goLive = () => {
  // Réinitialiser le flag de seek manuel
  manualSeek = false;
  
  // Vérifier que c'est aujourd'hui (en heure locale)
  const today = getLocalDateString();
  
  if (selectedDate.value !== today) {
    // Aller à aujourd'hui
    selectedDate.value = today;
  }
  
  // Déplacer le viewport à maintenant
  viewportCenterTimestamp.value = Date.now();
  
  // Activer le mode live
  isLive.value = true;
  
  // Remettre en lecture si on était en pause
  if (!isPlaying.value) {
    isPlaying.value = true;
  }
  
  // Arrêter la lecture normale
  stopPlayback();
  
  // Démarrer l'interval pour mettre à jour le timestamp en mode live
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
  }
  liveUpdateInterval = setInterval(() => {
    if (isLive.value) {
      viewportCenterTimestamp.value = Date.now();
    }
  }, 1000); // Mettre à jour chaque seconde
  
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

const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value;
  console.log('🔊 Audio toggled:', audioEnabled.value);
  
  // Redémarrer les streams avec ou sans audio
  updateAllStreams(true);
  if (fullscreenCamera.value) {
    startFullscreenStream();
  }
};

const updateVolume = (value) => {
  audioVolume.value = value / 100;
  console.log('🔉 Volume updated:', audioVolume.value);
  // Le volume sera appliqué par JMuxer/vidéo
};

// Mode édition pour réorganiser les caméras
const toggleEditMode = () => {
  editMode.value = !editMode.value;
  if (!editMode.value) {
    // Sauvegarder lors de la sortie du mode édition
    saveCameraOrder();
    saveHiddenCameras();
  }
};

const handleDragStart = (event, index) => {
  draggedIndex = index;
  isCameraDragging = true;
  event.dataTransfer.effectAllowed = 'move';
  event.target.style.opacity = '0.5';
  
  // Désactiver le scroll du container pendant le drag
  const grid = document.querySelector('.cameras-grid');
  if (grid) {
    grid.style.overflowY = 'hidden';
  }
  
  // Démarrer l'auto-scroll
  startAutoScroll();
};

const handleDragOver = (event, index) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  
  // Tracker la position Y pour l'auto-scroll
  lastDragY = event.clientY;
};

const handleDrop = (event, dropIndex) => {
  event.preventDefault();
  
  if (draggedIndex === null || draggedIndex === dropIndex) return;
  
  const cameras = [...filteredCameras.value];
  const draggedCamera = cameras[draggedIndex];
  
  // Réorganiser l'ordre
  cameras.splice(draggedIndex, 1);
  cameras.splice(dropIndex, 0, draggedCamera);
  
  // Mettre à jour cameraOrder avec le nouvel ordre
  cameraOrder.value = cameras.map(cam => cam.optionValue);
};

const handleDragEnd = (event) => {
  event.target.style.opacity = '1';
  draggedIndex = null;
  isCameraDragging = false;
  
  // Réactiver le scroll
  const grid = document.querySelector('.cameras-grid');
  if (grid) {
    grid.style.overflowY = 'auto';
  }
  
  // Arrêter l'auto-scroll
  stopAutoScroll();
};

const startAutoScroll = () => {
  if (autoScrollInterval) return;
  
  autoScrollInterval = setInterval(() => {
    if (!isCameraDragging) {
      stopAutoScroll();
      return;
    }
    
    const grid = document.querySelector('.cameras-grid');
    if (!grid) return;
    
    const gridRect = grid.getBoundingClientRect();
    const scrollZone = 80; // Zone de 80px en haut et en bas
    const scrollSpeed = 5; // Vitesse de scroll
    
    // Distance du curseur par rapport au haut/bas de la grille
    const distanceFromTop = lastDragY - gridRect.top;
    const distanceFromBottom = gridRect.bottom - lastDragY;
    
    // Scroll vers le haut
    if (distanceFromTop < scrollZone && distanceFromTop > 0) {
      const intensity = 1 - (distanceFromTop / scrollZone);
      grid.scrollTop -= scrollSpeed * intensity;
    }
    // Scroll vers le bas
    else if (distanceFromBottom < scrollZone && distanceFromBottom > 0) {
      const intensity = 1 - (distanceFromBottom / scrollZone);
      grid.scrollTop += scrollSpeed * intensity;
    }
  }, 16); // ~60fps
};

const stopAutoScroll = () => {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
};

// Gestion du drag tactile pour mobile
const handleTouchStart = (event, index) => {
  if (!editMode.value) return;
  
  draggedIndex = index;
  isCameraDragging = true;
  touchStartY = event.touches[0].clientY;
  lastDragY = touchStartY;
  
  // Trouver l'élément .camera-cell parent pour déplacer toute la tuile
  draggedElement = event.currentTarget.closest('.camera-cell');
  if (!draggedElement) return;
  
  draggedElement.style.opacity = '0.5';
  draggedElement.style.zIndex = '1000';
  draggedElement.style.transition = 'none';
  draggedElement.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
  draggedElement.style.transform = 'scale(1.05)';
  
  // Désactiver le scroll
  const grid = document.querySelector('.cameras-grid');
  if (grid) {
    grid.style.overflowY = 'hidden';
  }
  
  // Créer un placeholder
  placeholder = document.createElement('div');
  placeholder.className = 'camera-cell-placeholder';
  placeholder.style.height = draggedElement.offsetHeight + 'px';
  draggedElement.parentNode.insertBefore(placeholder, draggedElement.nextSibling);
  
  startAutoScroll();
};

const handleTouchMove = (event, index) => {
  if (!isCameraDragging || draggedIndex === null) return;
  
  event.preventDefault();
  const touch = event.touches[0];
  lastDragY = touch.clientY;
  
  // Déplacer visuellement l'élément
  const deltaY = touch.clientY - touchStartY;
  if (draggedElement) {
    draggedElement.style.transform = `translateY(${deltaY}px) scale(1.05)`;
  }
  
  // Déterminer la nouvelle position
  const grid = document.querySelector('.cameras-grid');
  if (!grid) return;
  
  const cells = Array.from(grid.querySelectorAll('.camera-cell:not(.camera-cell-placeholder)'));
  let newIndex = draggedIndex;
  
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === draggedElement) continue;
    
    const rect = cells[i].getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    
    if (touch.clientY < middle && i < draggedIndex) {
      newIndex = i;
      break;
    } else if (touch.clientY > middle && i > draggedIndex) {
      newIndex = i;
    }
  }
  
  // Réorganiser le placeholder si nécessaire
  if (newIndex !== draggedIndex && placeholder) {
    const targetCell = cells[newIndex];
    if (targetCell && targetCell !== draggedElement) {
      if (newIndex > draggedIndex) {
        targetCell.parentNode.insertBefore(placeholder, targetCell.nextSibling);
      } else {
        targetCell.parentNode.insertBefore(placeholder, targetCell);
      }
      draggedIndex = newIndex;
    }
  }
};

const handleTouchEnd = (event, index) => {
  if (!isCameraDragging || draggedIndex === null) return;
  
  // Réinitialiser les styles
  if (draggedElement) {
    draggedElement.style.transition = 'all 0.2s ease';
    draggedElement.style.opacity = '1';
    draggedElement.style.transform = '';
    draggedElement.style.zIndex = '';
    draggedElement.style.boxShadow = '';
    
    // Remettre la transition à none après l'animation
    setTimeout(() => {
      if (draggedElement) {
        draggedElement.style.transition = '';
      }
    }, 200);
  }
  
  // Retirer le placeholder
  if (placeholder && placeholder.parentNode) {
    placeholder.parentNode.removeChild(placeholder);
    placeholder = null;
  }
  
  // Mettre à jour l'ordre final
  const cameras = [...filteredCameras.value];
  const movedCamera = cameras.splice(index, 1)[0];
  cameras.splice(draggedIndex, 0, movedCamera);
  cameraOrder.value = cameras.map(cam => cam.optionValue);
  
  // Réactiver le scroll
  const grid = document.querySelector('.cameras-grid');
  if (grid) {
    grid.style.overflowY = 'auto';
  }
  
  stopAutoScroll();
  isCameraDragging = false;
  draggedIndex = null;
  draggedElement = null;
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
    
    // Avancer le timestamp
    let newTimestamp = viewportCenterTimestamp.value + progressMs;
    
    // Limiter à maintenant
    const now = Date.now();
    if (newTimestamp >= now) {
      newTimestamp = now;
      stopPlayback();
    }
    
    viewportCenterTimestamp.value = newTimestamp;
  }
  
  lastPlaybackTime = currentTime;
  playbackAnimationFrame = requestAnimationFrame(updatePlayback);
};

// Fonction pour le drag relatif
const seekToTimeRelative = (currentX) => {
  if (!timelineTrack.value || !dragStartRange) return;
  
  // Désactiver le mode live si on déplace le curseur
  if (isLive.value) {
    isLive.value = false;
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
  }
  
  // Utiliser la largeur capturée au début du drag (pas de recalcul)
  const deltaX = currentX - dragStartX;
  const deltaMs = (deltaX / dragStartRange.containerWidth) * dragStartRange.durationMs;
  
  // DRAG = déplacer le VIEWPORT (scroller la timeline), pas le curseur
  // Inverser le delta pour un comportement intuitif (drag vers la droite = scroll vers la gauche)
  let newTimestamp = dragStartTimestamp - deltaMs;
  
  // Si au-delà d'aujourd'hui, limiter à maintenant
  const now = Date.now();
  if (newTimestamp > now) {
    newTimestamp = now;
  }
  
  // Mettre à jour le timestamp directement - plus besoin de normalisation !
  viewportCenterTimestamp.value = newTimestamp;
};

// Interaction avec la timeline
const seekToTime = (e) => {
  if (!timelineTrack.value) return;
  
  // Ignorer le click si on vient de finir un drag
  if (justFinishedDrag) {
    justFinishedDrag = false;
    return;
  }
  
  // Ignorer les événements click qui suivent un touchstart (prévenir le double appel)
  if (e.type === 'click' && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) {
    return;
  }
  
  const rect = timelineTrack.value.getBoundingClientRect();
  // Support pour touch et mouse events
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const x = clientX - rect.left;
  const clickPercent = (x / rect.width) * 100; // Pourcentage dans la zone visible
  
  // Utiliser la plage gelée pendant le drag, sinon la plage actuelle
  const range = isDragging.value && dragStartRange ? dragStartRange : visibleRange.value;
  
  // Position en ms dans la plage visible
  const msInVisibleRange = (clickPercent / 100) * range.durationMs;
  let newTimestamp = range.startMs + msInVisibleRange;
  
  // Si au-delà d'aujourd'hui, limiter à maintenant
  const now = Date.now();
  const clickedInFuture = newTimestamp > now;
  if (clickedInFuture) {
    // Ne rien faire si on clique dans le futur - garder le mode live actif
    return;
  }
  
  // Désactiver le mode live si on déplace le curseur dans le passé
  if (isLive.value) {
    isLive.value = false;
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
  }
  
  // Déplacer le viewport
  viewportCenterTimestamp.value = newTimestamp;
  updateAllStreams(true); // Force restart pour seek manuel
};

const startDrag = (e) => {
  // Empêcher le comportement par défaut pour les touch events
  if (e.type === 'touchstart') {
    e.preventDefault();
  }
  
  // Indiquer que c'est une interaction manuelle
  manualSeek = true;
  
  // Capturer la position initiale du viewport
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  dragStartX = clientX;
  dragStartTimestamp = viewportCenterTimestamp.value;
  hasMoved = false;
  
  // Capturer la plage visible ET la largeur du conteneur AVANT de set isDragging
  const rect = timelineTrack.value.getBoundingClientRect();
  dragStartRange = { 
    ...visibleRange.value,
    containerWidth: rect.width  // Capturer la largeur pour éviter les recalculs
  };
  isDragging.value = true;
  
  const onMove = (e) => {
    if (isDragging.value) {
      if (e.type === 'touchmove') {
        e.preventDefault();
      }
      
      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      
      // TOUJOURS appeler seekToTimeRelative, même pour un petit mouvement
      seekToTimeRelative(currentX);
      
      // Marquer qu'il y a eu un mouvement de souris
      if (Math.abs(currentX - dragStartX) > 2) {
        hasMoved = true;
      }
    }
  };
  
  const onEnd = (e) => {
    // Vérifier si le timestamp a réellement changé (tolérance de 100ms)
    const timestampChanged = Math.abs(viewportCenterTimestamp.value - dragStartTimestamp) > 100;
    
    // C'est un TAP seulement si le timestamp n'a PAS changé
    if (!timestampChanged && timelineTrack.value) {
      // Pour un tap, utiliser la plage ACTUELLE (pas dragStartRange)
      const rect = timelineTrack.value.getBoundingClientRect();
      const x = dragStartX - rect.left;
      const clickPercent = (x / rect.width) * 100;
      
      // Utiliser visibleRange actuel pour le TAP
      const currentRange = visibleRange.value;
      const msInVisibleRange = (clickPercent / 100) * currentRange.durationMs;
      let newTimestamp = currentRange.startMs + msInVisibleRange;
      
      // Limiter si aujourd'hui
      const now = Date.now();
      if (newTimestamp > now) {
        newTimestamp = now;
      }
      
      // Déplacer le viewport
      viewportCenterTimestamp.value = newTimestamp;
      updateAllStreams(true);
      
      // Mettre à jour le fullscreen aussi si ouvert
      if (fullscreenCamera.value) {
        startFullscreenStream();
      }
    } else if (timestampChanged) {
      // DRAG détecté - la position a déjà été mise à jour correctement par mousemove
      // Marquer qu'on vient de finir un drag pour ignorer le click qui suit
      justFinishedDrag = true;
      
      // Juste limiter au présent si nécessaire
      const now = Date.now();
      if (viewportCenterTimestamp.value > now) {
        viewportCenterTimestamp.value = now;
      }
      
      // Mettre à jour les streams à la position finale
      updateAllStreams(true);
      
      // Mettre à jour le fullscreen aussi si ouvert
      if (fullscreenCamera.value) {
        startFullscreenStream();
      }
    }
    
    // Vérifier si on est proche de l'heure actuelle pour réactiver le mode live
    const now = Date.now();
    const diffMs = now - viewportCenterTimestamp.value;
    
    // Si proche de maintenant (< 5 secondes), activer le mode live
    if (diffMs < 5000 && diffMs > -2000) {
      manualSeek = false;
      isLive.value = true;
      // Démarrer le stream live
      updateAllStreams();
    }
    
    // Nettoyer les listeners AVANT de remettre isDragging à false
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
    
    // Remettre isDragging à false EN DERNIER pour éviter que le watch se déclenche trop tôt
    isDragging.value = false;
    dragStartRange = null;
    dragStartX = null;
    dragStartTimestamp = null;
    hasMoved = false;
    
    // Remettre manualSeek à false APRÈS un court délai pour que le watch ne se déclenche pas
    setTimeout(() => {
      manualSeek = false;
    }, 100);
  };
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
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
    // Mode LIVE: stream en temps réel avec meilleure qualité (paramètres UI3)
    mosaicUrl = `/video/index/2.0?session=${authStore.apiClient.session}&audio=${audioEnabled.value ? 1 : 0}&stream=0&w=1696&h=1248&q=23&kbps=3000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&extend=2`;
  } else {
    // Mode historique: utiliser directement viewportCenterTimestamp (déjà en ms epoch)
    const posMs = Math.floor(viewportCenterTimestamp.value);
    
    mosaicUrl = `/time/index?session=${authStore.apiClient.session}&pos=${posMs}&audio=${audioEnabled.value ? 1 : 0}&stream=0&w=1696&h=1248&q=23&kbps=3000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&speed=${streamSpeed.value}&extend=2`;
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
  mosaicVideo.style.width = '1696px';
  mosaicVideo.style.height = '1248px';
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
  tempCanvas.width = 1696;
  tempCanvas.height = 1248;
  const tempCtx = tempCanvas.getContext('2d');
  
  let frameCount = 0;
  
  captureInterval = setInterval(() => {
    if (!mosaicVideo || mosaicVideo.paused || mosaicVideo.ended) {
      return;
    }
    
    // Dessiner la vidéo sur le canvas temporaire
    tempCtx.drawImage(mosaicVideo, 0, 0, 1696, 1248);
    
    // Créer une image depuis le canvas avec moins de compression
    const img = new Image();
    img.onload = () => {
      mosaicImg.value = img;
      drawMosaicToCanvases();
      frameCount++;
      if (frameCount <= 5 || frameCount % 60 === 0) {
        console.log('✅ Frame captured:', frameCount);
      }
    };
    img.src = tempCanvas.toDataURL('image/jpeg', 0.95);
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
  const staticRecList = [[2,76,350,694],[394,24,692,248],[775,24,1174,248],[1256,24,1656,248],[374,274,793,746],[837,274,1234,497],[1277,274,1675,497],[832,523,1229,746],[1261,523,1681,996],[138,772,436,996],[710,772,1109,996],[225,1022,623,1246],[1073,1022,1471,1246]];
  
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
  
  console.log('Using static camera mapping (1696×1248):', cameraRects.value);
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
  
  const now = Date.now();
  
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
        
        // Calculer FPS pour cette caméra
        const cameraId = camera.optionValue;
        const lastFrameTime = cameraFrameTimes.value[cameraId];
        if (lastFrameTime) {
          const deltaTime = now - lastFrameTime;
          if (deltaTime > 0) {
            const fps = Math.round(1000 / deltaTime);
            cameraFPS.value[cameraId] = fps;
          }
        }
        cameraFrameTimes.value[cameraId] = now;
        
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
  
  // Calculer la moyenne des FPS de toutes les caméras visibles
  const fpsValues = Object.values(cameraFPS.value);
  if (fpsValues.length > 0) {
    const avgFPS = Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length);
    serverStatus.value.fps = avgFPS;
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
  
  // Mode historique : utiliser directement viewportCenterTimestamp
  const targetTimestamp = Math.floor(viewportCenterTimestamp.value / 1000);
  
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
  manualSeek = false; // Réinitialiser le flag lors du changement de date
  loadDayEvents();
});

// NOTE: La normalisation de la date se fait maintenant dans seekToTimeRelative
// pour éviter les sauts de plusieurs jours et le décalage au relâchement.
// Le watch de sécurité est désactivé car il créait des interférences avec le drag.
// La normalisation dans seekToTimeRelative est suffisante.

/*
// Optionnel: watch de sécurité pour les cas où viewport est modifié hors drag
let isAdjustingDate = false;
watch(viewportCenterPercent, (newPercent) => {
  if (isAdjustingDate || isDragging.value) return; // Ignorer pendant le drag
  
  // Si on dépasse 100% (vers le futur) - cas rare hors drag
  if (newPercent >= 100) {
    console.log('📅 [Safety] Passage au jour suivant, viewport:', newPercent);
    isAdjustingDate = true;
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    
    const today = getLocalDateString();
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    if (newDate <= today) {
      selectedDate.value = newDate;
      viewportCenterPercent.value = newPercent - 100;
    } else {
      viewportCenterPercent.value = 100;
    }
    setTimeout(() => { isAdjustingDate = false; }, 0);
  }
  // Si on dépasse en négatif (vers le passé) - cas rare hors drag
  else if (newPercent < 0) {
    console.log('📅 [Safety] Passage au jour précédent, viewport:', newPercent);
    isAdjustingDate = true;
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    selectedDate.value = newDate;
    viewportCenterPercent.value = 100 + newPercent;
    setTimeout(() => { isAdjustingDate = false; }, 0);
  }
});
*/

// Mettre à jour seulement si on n'est pas en lecture (sinon c'est fait dans updatePlayback)
watch(viewportCenterTimestamp, () => {
  // Ne pas réactiver automatiquement le live après une interaction manuelle
  if (!manualSeek) {
    // Mettre à jour automatiquement isLive basé sur la position du viewport
    const now = Date.now();
    const diffMs = now - viewportCenterTimestamp.value;
    
    // Si proche de maintenant (< 5 secondes dans le futur, < 2 secondes dans le passé)
    const wasLive = isLive.value;
    
    if (diffMs < 5000 && diffMs > -2000) {
      isLive.value = true;
    } else {
      isLive.value = false;
    }
    
    // Logger le changement de mode
    if (wasLive !== isLive.value) {
      console.log(`🔄 Mode changed: ${wasLive ? 'LIVE' : 'HISTORICAL'} → ${isLive.value ? 'LIVE' : 'HISTORICAL'}`);
    }
  }
  
  // Mettre à jour la mosaïque seulement si en pause ET si on n'est pas en train de dragger
  // ET si ce n'est pas un seek manuel (car onEnd va déjà appeler updateAllStreams)
  if (!isPlaying.value && !isDragging.value && !manualSeek) {
    updateAllStreams();
  }
  
  // Mettre à jour le stream fullscreen SEULEMENT si en pause (seek manuel) ET si on n'est pas en train de dragger
  // Pendant la lecture, le stream continue naturellement sans redémarrage
  if (fullscreenCamera.value && !isPlaying.value && !isDragging.value && !manualSeek) {
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

// Auto-scroll des heures en mobile pour suivre le viewport
watch(() => viewportCenterTimestamp.value, () => {
  if (isMobile.value && timelineHoursRef.value) {
    nextTick(() => {
      const container = timelineHoursRef.value;
      if (!container) return;
      
      // Calculer la position du viewport en pixels
      // Convertir le timestamp en position dans la journée
      const date = new Date(viewportCenterTimestamp.value);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const percentInDay = ((viewportCenterTimestamp.value - dayStart) / (dayEnd - dayStart)) * 100;
      
      const containerWidth = container.scrollWidth;
      const viewportWidth = container.clientWidth;
      const centerPixelPosition = (percentInDay / 100) * containerWidth;
      
      // Centrer le scroll sur le viewport
      const targetScroll = centerPixelPosition - (viewportWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    });
  }
});

// Plein écran pour une caméra
const openFullscreenCamera = (cameraId) => {
  // Forcer la mise à jour du mode LIVE/HISTORICAL avant d'ouvrir
  const now = Date.now();
  const diffMs = now - viewportCenterTimestamp.value;
  
  if (diffMs < 5000 && diffMs > -2000) {
    isLive.value = true;
  } else {
    isLive.value = false;
  }
  
  console.log(`📸 Opening fullscreen for ${cameraId} - Mode: ${isLive.value ? 'LIVE' : 'HISTORICAL'}, diffMs: ${diffMs.toFixed(0)}`);
  
  fullscreenCamera.value = cameraId;
  
  // Ajouter une entrée dans l'historique pour le bouton retour
  window.history.pushState({ fullscreen: true }, '');
  
  nextTick(() => {
    startFullscreenStream();
  });
};

const handleBackButton = (event) => {
  if (fullscreenCamera.value) {
    event.preventDefault();
    closeFullscreenCamera();
  }
};

const closeFullscreenCamera = () => {
  stopFullscreenStream();
  fullscreenCamera.value = null;
};

const startFullscreenStream = async () => {
  // Toujours arrêter d'abord pour s'assurer d'un état propre
  stopFullscreenStream();
  
  if (!fullscreenCamera.value) return;
  
  const cameraId = fullscreenCamera.value;
  let streamUrl;
  
  if (isLive.value) {
    // Mode LIVE pour une caméra (paramètres UI3)
    streamUrl = `/video/${cameraId}/2.0?session=${authStore.apiClient.session}&audio=${audioEnabled.value ? 1 : 0}&stream=0&w=1920&h=1080&q=23&kbps=3000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&extend=2`;
    console.log('🔴 Fullscreen LIVE mode for', cameraId);
  } else {
    // Mode historique pour une caméra - utiliser directement viewportCenterTimestamp
    const posMs = Math.floor(viewportCenterTimestamp.value);
    streamUrl = `/time/${cameraId}?session=${authStore.apiClient.session}&pos=${posMs}&audio=${audioEnabled.value ? 1 : 0}&stream=0&w=1920&h=1080&q=23&kbps=3000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&speed=${streamSpeed.value}&extend=2`;
    console.log('⏱️ Fullscreen HISTORICAL mode for', cameraId, 'at', formatCursorTime.value, '(pos:', posMs, ') - speed:', streamSpeed.value);
  }
  
  console.log('🎬 Starting fullscreen stream for', cameraId, ':', streamUrl);
  
  // Créer l'élément vidéo
  fullscreenVideo = document.getElementById('fullscreen-video');
  if (!fullscreenVideo) {
    console.error('❌ Fullscreen video element not found!');
    return;
  }
  console.log('✅ Fullscreen video element found:', fullscreenVideo);
  
  // Parser Blue Iris
  fullscreenParser = new BlueIrisParser(
    (frame) => {
      if (!fullscreenJmuxer) {
        console.log('🎬 Initializing fullscreen JMuxer with codec:', frame.codec);
        fullscreenJmuxer = new JMuxer({
          node: fullscreenVideo,
          mode: 'video',
          videoCodec: frame.codec,
          debug: false,
          onReady: () => {
            console.log('✅ Fullscreen JMuxer ready, starting playback');
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
  console.log('🛑 Stopping fullscreen stream');
  
  if (fullscreenSeekDebounceTimeout) {
    clearTimeout(fullscreenSeekDebounceTimeout);
    fullscreenSeekDebounceTimeout = null;
  }
  
  if (fullscreenAbortController) {
    fullscreenAbortController.abort();
    fullscreenAbortController = null;
  }
  
  if (fullscreenJmuxer) {
    console.log('🗑️ Destroying fullscreen JMuxer');
    try {
      fullscreenJmuxer.destroy();
    } catch (err) {
      console.warn('⚠️ Error destroying JMuxer:', err);
    }
    fullscreenJmuxer = null;
  }
  
  if (fullscreenParser) {
    try {
      fullscreenParser.reset();
    } catch (err) {
      console.warn('⚠️ Error resetting parser:', err);
    }
    fullscreenParser = null;
  }
  
  // Nettoyer complètement l'élément vidéo
  const video = document.getElementById('fullscreen-video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load(); // Force reset
    // Attendre que le MediaSource soit vraiment libéré
    if (video.srcObject) {
      video.srcObject = null;
    }
  }
};

// Gestion de l'affichage de la timeline en fullscreen
let hideTimelineTimeout = null;
let lastMouseY = 0;

const handleMouseMove = (e) => {
  if (fullscreenCamera.value) {
    const mouseY = e.clientY;
    const windowHeight = window.innerHeight;
    
    // Afficher les contrôles si la souris est en haut (20%) ou en bas (80%) de l'écran
    if (mouseY < windowHeight * 0.2 || mouseY > windowHeight * 0.8) {
      showTimelineBar.value = true;
      
      // Masquer après 3 secondes d'inactivité
      if (hideTimelineTimeout) clearTimeout(hideTimelineTimeout);
      hideTimelineTimeout = setTimeout(() => {
        showTimelineBar.value = false;
      }, 3000);
    }
    
    lastMouseY = mouseY;
  }
};

const handleTouch = (e) => {
  if (fullscreenCamera.value) {
    showTimelineBar.value = !showTimelineBar.value;
    
    // Masquer après 3 secondes si visible
    if (showTimelineBar.value) {
      if (hideTimelineTimeout) clearTimeout(hideTimelineTimeout);
      hideTimelineTimeout = setTimeout(() => {
        showTimelineBar.value = false;
      }, 3000);
    }
  }
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
  
  // Charger l'ordre des caméras et les caméras masquées
  loadCameraOrder();
  loadHiddenCameras();
  loadSelectedCameras();
  
  // Démarrer le polling des infos système
  updateServerStatus();
  statusUpdateInterval = setInterval(updateServerStatus, 2000);
  
  // Gérer le bouton retour pour fermer le fullscreen
  window.addEventListener('popstate', handleBackButton);
  
  // Event listeners pour l'affichage de la timeline en fullscreen
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('touchstart', handleTouch);
});

onUnmounted(() => {
  // Cleanup playback
  stopPlayback();
  
  // Cleanup event listeners
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('touchstart', handleTouch);
  
  // Cleanup live updates
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
    liveUpdateInterval = null;
  }
  
  // Cleanup status updates
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  
  // Cleanup mosaic stream
  stopMosaicStream();
  
  // Retirer le listener du bouton retour
  window.removeEventListener('popstate', handleBackButton);
});
</script>

<style scoped>
.timeline-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  overflow-x: clip; /* Empêcher le débordement horizontal sans casser sticky */
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .timeline-view {
    font-size: 14px;
  }
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-lg);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-bottom {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.system-info {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 13px;
}

.info-label {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.info-value {
  color: var(--color-accent);
  font-weight: 600;
}

@media (max-width: 768px) {
  .header {
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
  }
  
  .header-top h1 {
    font-size: 14px;
    margin: 0;
  }
  
  .header-bottom {
    flex-direction: column;
    gap: var(--spacing-xs);
    align-items: stretch;
  }
  
  .header-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-xs);
    width: 100%;
  }
  
  .system-info {
    gap: var(--spacing-sm);
  }
  
  .info-item {
    font-size: 11px;
  }
  
  .date-picker {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex: 1;
    min-width: 0;
  }
  
  .date-picker .btn-icon {
    width: 32px;
    height: 32px;
    padding: 4px;
  }
  
  .date-picker .btn-icon svg {
    width: 16px;
    height: 16px;
  }
  
  .date-input {
    font-size: 13px;
    padding: 4px 8px;
    max-width: 140px;
  }
  
  .camera-filters {
    width: 100%;
  }
}

.header h1 {
  font-size: 18px;
  margin: 0;
  white-space: nowrap;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.date-input {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 14px;
}

.btn-edit {
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
  white-space: nowrap;
}

.btn-edit svg {
  width: 16px;
  height: 16px;
}

.btn-edit:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.btn-edit.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.camera-filters {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  flex: 1;
  order: 1;
}

.btn-edit {
  order: 2;
}

/* Sur desktop, mettre le bouton édition après les filtres */
@media (min-width: 769px) {
  .header-controls {
    order: 2;
    flex: 0 0 auto;
  }
  
  .camera-filters {
    order: 1;
  }
  
  .date-picker {
    order: 1;
  }
  
  .btn-edit {
    order: 2;
    margin-left: auto;
  }
}

@media (max-width: 768px) {
  .camera-filters {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .camera-filters::-webkit-scrollbar {
    display: none;
  }
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
  grid-template-columns: repeat(auto-fit, minmax(380px, 500px));
  justify-content: center;
  align-content: start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  padding-bottom: 180px; /* Espace pour la timeline fixe en bas */
  overflow-y: auto;
  overflow-x: hidden;
}

.cameras-grid .camera-cell {
  width: 100%;
  max-width: 100%;
}

/* Caméra unique : maximiser la taille en respectant le ratio */
.cameras-grid.single-camera {
  display: flex !important;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md);
}

.cameras-grid.single-camera .camera-cell {
  width: calc(min(95vw, (100vh - 370px) * 16 / 9));
  height: calc(min(95vw * 9 / 16, 100vh - 370px));
  max-width: 95vw;
  max-height: calc(100vh - 370px);
  aspect-ratio: 16/9;
}

.cameras-grid.single-camera .camera-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Deux caméras : optimiser l'espace */
.cameras-grid.dual-camera {
  display: flex !important;
  gap: var(--spacing-md);
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md);
}

.cameras-grid.dual-camera .camera-cell {
  width: calc(min(48vw, (100vh - 240px) * 16 / 9));
  height: calc(min(48vw * 9 / 16, 100vh - 240px));
  max-width: 48vw;
  max-height: calc(100vh - 240px);
  aspect-ratio: 16/9;
  flex-shrink: 0;
}

.cameras-grid.dual-camera .camera-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* En mode mobile, empiler les 2 caméras verticalement */
@media (max-width: 768px) {
  .cameras-grid.dual-camera {
    flex-direction: column;
  }
  
  .cameras-grid.dual-camera .camera-cell {
    width: calc(min(95vw, (50vh - 185px) * 16 / 9));
    height: calc(min(95vw * 9 / 16, 50vh - 185px));
    max-width: 95vw;
    max-height: calc(50vh - 185px);
  }
}

/* 3-4 caméras : grille 2x2 optimisée */
.cameras-grid[style*="repeat(2, 1fr)"] .camera-cell {
  width: calc(min((95vw - 32px - 8px) / 2, ((100vh - 370px - 32px - 8px) / 2) * 16 / 9)) !important;
  height: calc(min(((95vw - 32px - 8px) / 2) * 9 / 16, (100vh - 370px - 32px - 8px) / 2)) !important;
  max-width: calc((95vw - 32px - 8px) / 2) !important;
  max-height: calc((100vh - 370px - 32px - 8px) / 2) !important;
  aspect-ratio: 16/9 !important;
  justify-self: center;
  align-self: center;
}

.cameras-grid[style*="repeat(2, 1fr)"] .camera-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 768px) {
  .cameras-grid[style*="repeat(2, 1fr)"] .camera-cell,
  .cameras-grid[style*="gridTemplateColumns"] .camera-cell {
    width: 100% !important;
    height: auto !important;
    max-width: 100% !important;
    aspect-ratio: 16/9 !important;
  }
  
  .cameras-grid[style*="repeat(2, 1fr)"] .camera-canvas,
  .cameras-grid[style*="gridTemplateColumns"] .camera-canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

/* 5-6 caméras : grille 3x2 optimisée */
.cameras-grid[style*="repeat(3, 1fr)"] .camera-cell {
  width: calc(min((95vw - 32px - 16px) / 3, ((100vh - 370px - 32px - 8px) / 2) * 16 / 9)) !important;
  height: calc(min(((95vw - 32px - 16px) / 3) * 9 / 16, (100vh - 370px - 32px - 8px) / 2)) !important;
  max-width: calc((95vw - 32px - 16px) / 3) !important;
  max-height: calc((100vh - 370px - 32px - 8px) / 2) !important;
  aspect-ratio: 16/9 !important;
  justify-self: center;
  align-self: center;
}

.cameras-grid[style*="repeat(3, 1fr)"] .camera-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 768px) {
  .cameras-grid[style*="repeat(3, 1fr)"] .camera-cell {
    width: calc(min(95vw - 32px, ((100vh - 370px) / 6 - 20px) * 16 / 9)) !important;
    height: calc(min((95vw - 32px) * 9 / 16, (100vh - 370px) / 6 - 20px)) !important;
    max-width: calc(95vw - 32px) !important;
    max-height: calc((100vh - 370px) / 6 - 20px) !important;
  }
}

.cameras-grid.edit-mode .camera-cell {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    border-color: var(--color-border);
  }
  50% {
    border-color: var(--color-accent);
  }
}

@media (max-width: 768px) {
  .cameras-grid {
    grid-template-columns: 1fr;
    padding: var(--spacing-xs);
    gap: var(--spacing-xs);
    padding-bottom: 240px; /* Espace pour timeline + menu navigation */
  }
  
  /* En mode édition, enlever le padding du bas puisque timeline et nav sont cachés */
  .cameras-grid.edit-mode {
    padding-bottom: var(--spacing-md);
  }
  
  /* Vue compacte pour le mode édition mobile */
  .cameras-grid.compact-edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  
  .camera-cell.compact-edit-cell {
    aspect-ratio: unset;
    height: 56px;
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
    border: 2px solid var(--color-border);
    padding: 0 12px;
    cursor: default;
    transition: all 0.2s ease;
    touch-action: pan-y;
  }
  
  .camera-cell.compact-edit-cell.hidden {
    opacity: 0.5;
    background: linear-gradient(135deg, rgba(51, 65, 85, 0.6) 0%, rgba(30, 41, 59, 0.6) 100%);
    border-color: rgba(148, 163, 184, 0.3);
  }
  
  .camera-cell.compact-edit-cell:active {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    border-color: var(--color-accent);
  }
  
  .camera-name.compact-name {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text);
    background: transparent;
    padding: 0;
    position: relative;
    top: 0;
    left: 0;
    right: auto;
    border-radius: 0;
    backdrop-filter: none;
  }
  
  .camera-name.compact-name .drag-handle {
    width: 24px;
    height: 24px;
    color: rgba(148, 163, 184, 0.9);
    flex-shrink: 0;
    padding: 4px;
    margin: -4px;
    cursor: grab;
    touch-action: none;
  }
  
  .camera-name.compact-name .drag-handle:active {
    cursor: grabbing;
    color: var(--color-accent);
  }
  
  .compact-edit-cell .btn-toggle-visibility {
    position: relative;
    top: auto;
    right: auto;
    margin-left: 8px;
    width: 40px;
    height: 40px;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  
  .compact-edit-cell .btn-toggle-visibility.hidden {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
  }
  
  .compact-edit-cell .btn-toggle-visibility svg {
    width: 20px;
    height: 20px;
  }
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

.camera-cell.draggable {
  cursor: move;
  user-select: none;
  /* touch-action: none déplacé vers .drag-handle seulement */
}

.camera-cell.draggable:hover {
  transform: scale(1.02);
  border-color: var(--color-accent);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.camera-cell-placeholder {
  background: rgba(59, 130, 246, 0.2);
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-md);
  margin: 0;
  transition: all 0.2s ease;
}

.camera-cell.dragging {
  opacity: 0.5;
}

.camera-cell.hidden {
  opacity: 0.4;
  filter: grayscale(100%);
}

.camera-cell.inactive {
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
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.drag-handle {
  width: 18px;
  height: 18px;
  min-width: 18px;
  color: white;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.drag-handle:hover {
  opacity: 1;
}

.recording-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.recording-indicator:hover {
  transform: scale(1.15);
}

.recording-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  animation: recordingPulse 2s ease-in-out infinite;
}

/* Enregistrement automatique - rouge vif */
.recording-indicator.auto-recording .recording-dot {
  background: #ef4444;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.9);
}

/* Enregistrement manuel - rouge orangé */
.recording-indicator.manual-recording .recording-dot {
  background: #f97316;
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.9);
  animation: manualRecordingPulse 1.5s ease-in-out infinite;
}

/* Pas d'enregistrement - gris */
.recording-indicator.not-recording .recording-dot {
  background: #9ca3af;
  box-shadow: 0 0 6px rgba(156, 163, 175, 0.5);
  animation: none;
  opacity: 0.7;
}

.recording-indicator.not-recording:hover .recording-dot {
  background: #6b7280;
  opacity: 1;
}

@keyframes recordingPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
}

@keyframes manualRecordingPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
}

.triggered-indicator {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  background: rgba(251, 191, 36, 0.95);
  border-radius: var(--radius-sm);
  animation: triggeredPulse 1.5s ease-in-out infinite;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.6);
}

.triggered-indicator svg {
  width: 16px;
  height: 16px;
  color: #78350f;
}

@keyframes triggeredPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.btn-toggle-visibility {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-md);
  cursor: pointer;
  z-index: 15;
  transition: var(--transition);
}

.btn-toggle-visibility svg {
  width: 20px;
  height: 20px;
  color: white;
}

.btn-toggle-visibility:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: var(--color-accent);
  transform: scale(1.1);
}

.btn-toggle-visibility.hidden {
  background: rgba(220, 38, 38, 0.7);
  border-color: rgba(220, 38, 38, 0.5);
}

.btn-toggle-visibility.hidden:hover {
  background: rgba(220, 38, 38, 0.9);
  border-color: rgb(220, 38, 38);
}

.camera-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* Barre de timeline */
.timeline-bar {
  background: var(--color-surface);
  border-top: 2px solid var(--color-border);
  padding: var(--spacing-sm) var(--spacing-md);
  position: fixed;
  bottom: 70px; /* Au-dessus du menu de navigation */
  left: 0;
  right: 0;
  z-index: 20;
  overflow-x: hidden; /* Empêcher le débordement horizontal */
  overflow-y: visible; /* Permettre à l'heure du slider de dépasser */
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* Timeline cachée en fullscreen */
.timeline-bar.timeline-hidden {
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
}

/* Timeline bar en mode fullscreen - prend la place du bas */
body:has(.fullscreen-camera) .timeline-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 210;
  background: rgba(0, 0, 0, 0.5); /* Plus transparent */
  backdrop-filter: blur(10px);
  border-top-color: rgba(59, 130, 246, 0.3);
}

@media (max-width: 768px) {
  .timeline-bar {
    padding: var(--spacing-xs);
  }
}

/* Contrôles de lecture */
.playback-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

@media (max-width: 768px) {
  .playback-controls {
    gap: var(--spacing-xs);
    flex-wrap: nowrap;
    justify-content: space-between;
    margin-bottom: 4px;
    overflow: visible;
  }
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

@media (max-width: 768px) {
  .btn-live {
    height: 32px;
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .btn-live svg {
    width: 14px;
    height: 14px;
  }
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
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

@media (max-width: 768px) {
  .btn-play {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
  }
  
  .btn-play svg {
    width: 14px;
    height: 14px;
  }
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

.btn-audio {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 2px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.btn-audio:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.btn-audio.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.btn-audio svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 768px) {
  .btn-audio {
    width: 32px;
    height: 32px;
  }
  
  .btn-audio svg {
    width: 16px;
    height: 16px;
  }
}

.volume-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 0 var(--spacing-sm);
  background: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  height: 30px;
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
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(59, 130, 246, 0.3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-accent);
  border-radius: 50%;
  cursor: pointer;
  transition: var(--transition);
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: var(--transition);
}

.volume-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.volume-label {
  color: var(--color-text);
  font-size: 10px;
  font-weight: 500;
  min-width: 35px;
  text-align: center;
}

@media (max-width: 768px) {
  .volume-control {
    height: 28px;
  }
  
  .volume-slider {
    width: 60px;
  }
  
  .volume-label {
    font-size: 9px;
    min-width: 30px;
  }
}

.speed-controls {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.speed-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
}

.speed-select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  min-width: 70px;
}

.speed-select:hover {
  border-color: var(--color-accent);
  background: var(--color-background);
}

.speed-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

@media (max-width: 768px) {
  .speed-controls {
    gap: 4px;
  }
  
  .speed-label {
    font-size: 10px;
  }
  
  .speed-select {
    min-width: 55px;
    font-size: 10px;
    padding: 4px 6px;
    height: 28px;
  }
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
  margin-left: auto;
  padding-left: var(--spacing-md);
  border-left: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .zoom-controls {
    margin-left: auto;
    padding-left: var(--spacing-xs);
    border-left: none;
  }
  
  .zoom-label {
    min-width: 32px;
    font-size: 10px;
  }
  
  .btn-zoom {
    width: 28px;
    height: 28px;
    padding: 4px;
  }
  
  .btn-zoom svg {
    width: 16px;
    height: 16px;
  }
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
  overflow-x: hidden; /* Empêcher le débordement horizontal des marqueurs */
  overflow-y: visible; /* Permettre à l'heure du slider de dépasser */
}

.detection-icons-zone {
  position: relative;
  height: 28px;
  margin-bottom: 4px;
  overflow: visible;
}

.detection-icon-marker {
  position: absolute;
  transform: translateX(-50%) translateZ(0);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: transform 0.2s;
  cursor: pointer;
  z-index: 10;
  will-change: left;
  backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
}

.detection-icon-marker svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.detection-icon-marker.detection-person {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.detection-icon-marker.detection-vehicle {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.detection-icon-marker.detection-animal {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.detection-icon-marker:hover {
  transform: translateX(-50%) scale(1.15) translateZ(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  .detection-icons-zone {
    height: 24px;
  }
  
  .detection-icon-marker {
    width: 20px;
    height: 20px;
    padding: 3px;
  }
  
  .detection-icon-marker svg {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 768px) {
  .timeline-hours {
    font-size: 10px;
    height: 16px;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 4px;
  }
  
  .timeline-hours::-webkit-scrollbar {
    height: 3px;
  }
  
  .timeline-hours::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .timeline-hours::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
}

.hour-marker {
  position: absolute;
  transform: translateX(-50%) translateZ(0);
  white-space: nowrap;
  will-change: left;
  backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
  top: 4px;
}

@media (max-width: 768px) {
  .hour-marker {
    top: 2px;
  }
}

.cursor-time-display {
  position: absolute;
  top: -2px;
  transform: translateX(-50%) translateZ(0);
  background: var(--color-accent);
  color: white;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 200;
  pointer-events: none;
  will-change: left;
  backface-visibility: hidden;
}

@media (max-width: 768px) {
  .cursor-time-display {
    font-size: 10px;
    padding: 2px 8px;
    top: 0px;
  }
}

@media (max-width: 768px) {
  .hour-marker {
    font-weight: 500;
  }
}

.timeline-track {
  position: relative;
  height: 40px;
  background: var(--color-background);
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden; /* Empêcher le débordement des événements et curseur hors vue */
  touch-action: none;
}

.future-zone {
  position: absolute;
  top: 0;
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    rgba(100, 100, 100, 0.15),
    rgba(100, 100, 100, 0.15) 10px,
    rgba(80, 80, 80, 0.1) 10px,
    rgba(80, 80, 80, 0.1) 20px
  );
  pointer-events: none;
  z-index: 5;
  border-left: 2px solid rgba(150, 150, 150, 0.3);
}

@media (max-width: 768px) {
  .timeline-track {
    height: 35px;
  }
  
  .event-marker {
    height: 35px;
  }
}

.event-marker {
  position: absolute;
  top: 0;
  height: 40px;
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
  transform: translateX(-50%) translateZ(0);
  z-index: 100;
  pointer-events: none;
  will-change: left;
  backface-visibility: hidden;
}

.cursor-handle {
  width: 3px;
  height: 80px;
  background: var(--color-accent);
  border-radius: 2px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  pointer-events: auto;
  cursor: ew-resize;
  backface-visibility: hidden;
}

.cursor-time {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%) translateZ(0);
  background: var(--color-accent);
  color: white;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  will-change: contents;
  backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
}

@media (max-width: 768px) {
  .cursor-time {
    font-size: 10px;
    padding: 2px 6px;
  }
}

/* Vue plein écran pour une caméra */
.fullscreen-camera {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  z-index: 200;
  overflow: hidden;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  transition: transform 0.3s ease, opacity 0.3s ease;
  backdrop-filter: blur(10px);
}

/* Header caché en fullscreen */
.fullscreen-header.header-hidden {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
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
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.fullscreen-video-container video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Contrôles PTZ en plein écran */
.ptz-controls {
  position: absolute;
  right: 20px;
  bottom: 200px;
  z-index: 250;
}

.btn-ptz-toggle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.btn-ptz-toggle:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: var(--color-accent);
  transform: scale(1.1);
}

.btn-ptz-toggle svg {
  width: 24px;
  height: 24px;
}

.ptz-overlay {
  position: absolute;
  right: 60px;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex;
  gap: var(--spacing-sm);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.ptz-dpad {
  display: grid;
  grid-template-columns: repeat(3, 48px);
  grid-template-rows: repeat(3, 48px);
  gap: 4px;
}

.ptz-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  color: white;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.ptz-btn:hover {
  background: rgba(59, 130, 246, 0.5);
  border-color: var(--color-accent);
  transform: scale(1.05);
}

.ptz-btn:active {
  background: rgba(59, 130, 246, 0.7);
  transform: scale(0.95);
}

.ptz-up { grid-column: 2; grid-row: 1; }
.ptz-left { grid-column: 1; grid-row: 2; }
.ptz-center { grid-column: 2; grid-row: 2; }
.ptz-right { grid-column: 3; grid-row: 2; }
.ptz-down { grid-column: 2; grid-row: 3; }

.ptz-zoom {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ptz-zoom .ptz-btn {
  width: 48px;
  height: 70px;
  font-size: 28px;
  font-weight: bold;
}

.ptz-presets {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ptz-presets .ptz-btn {
  width: 48px;
  height: 42px;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .ptz-controls {
    right: 10px;
    bottom: 180px;
  }
  
  .btn-ptz-toggle {
    width: 38px;
    height: 38px;
  }
  
  .btn-ptz-toggle svg {
    width: 20px;
    height: 20px;
  }
  
  .ptz-overlay {
    right: 50px;
    padding: 8px;
    gap: 6px;
    background: rgba(0, 0, 0, 0.4);
  }
  
  .ptz-dpad {
    grid-template-columns: repeat(3, 36px);
    grid-template-rows: repeat(3, 36px);
    gap: 3px;
  }
  
  .ptz-btn {
    font-size: 16px;
  }
  
  .ptz-zoom .ptz-btn {
    width: 36px;
    height: 52px;
    font-size: 22px;
  }
  
  .ptz-presets .ptz-btn {
    width: 36px;
    height: 32px;
    font-size: 11px;
  }
}
</style>
