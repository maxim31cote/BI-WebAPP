<template>
  <div class="timeline-view">
    <div class="header">
      <h1>{{ t('timeline.title') }}</h1>
    </div>

    <div class="timeline-container">
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

      <div class="events-container">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="events.length === 0" class="empty-state">
          <p>{{ t('timeline.noEvents') }}</p>
        </div>

        <div v-else class="timeline-events">
          <div
            v-for="event in events"
            :key="event.id"
            @click="viewEvent(event)"
            class="event-item"
            :class="event.type"
          >
            <div class="event-time">{{ formatTime(event.timestamp) }}</div>
            <div class="event-content">
              <div class="event-header">
                <span class="event-camera">{{ event.camera }}</span>
                <span class="event-type-badge" :class="event.type">
                  {{ t(`timeline.${event.type}`) }}
                </span>
              </div>
              <div class="event-thumbnail" v-if="event.thumbnail">
                <img :src="event.thumbnail" :alt="event.camera" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline graphique -->
      <div class="timeline-graph">
        <canvas ref="timelineCanvas" @click="handleTimelineClick"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

const selectedDate = ref(new Date().toISOString().split('T')[0]);
const events = ref([]);
const loading = ref(false);
const timelineCanvas = ref(null);

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

const loadEvents = async () => {
  loading.value = true;
  
  // Simuler le chargement des événements
  // Dans une vraie implémentation, utiliser l'API Blue Iris
  setTimeout(() => {
    events.value = generateMockEvents();
    loading.value = false;
    nextTick(() => {
      drawTimeline();
    });
  }, 500);
};

const generateMockEvents = () => {
  const mockEvents = [];
  const baseTime = new Date(selectedDate.value).getTime();
  
  for (let i = 0; i < 20; i++) {
    const randomHour = Math.floor(Math.random() * 24);
    const randomMinute = Math.floor(Math.random() * 60);
    const timestamp = baseTime + (randomHour * 3600 + randomMinute * 60) * 1000;
    
    mockEvents.push({
      id: `event_${i}`,
      timestamp: timestamp,
      camera: `Camera ${Math.floor(Math.random() * 4) + 1}`,
      type: ['motion', 'alert', 'recording'][Math.floor(Math.random() * 3)],
      thumbnail: null
    });
  }
  
  return mockEvents.sort((a, b) => b.timestamp - a.timestamp);
};

const viewEvent = (event) => {
  console.log('View event:', event);
  // Naviguer vers le clip correspondant
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

const drawTimeline = () => {
  if (!timelineCanvas.value) return;
  
  const canvas = timelineCanvas.value;
  const ctx = canvas.getContext('2d');
  
  // Ajuster la taille du canvas
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = 60 * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  const width = canvas.offsetWidth;
  const height = 60;
  
  // Fond
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-surface');
  ctx.fillRect(0, 0, width, height);
  
  // Ligne de temps
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  
  // Marques d'heures
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary');
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  
  for (let hour = 0; hour < 24; hour += 3) {
    const x = (hour / 24) * width;
    ctx.beginPath();
    ctx.moveTo(x, height / 2 - 5);
    ctx.lineTo(x, height / 2 + 5);
    ctx.stroke();
    ctx.fillText(`${hour}h`, x, height - 5);
  }
  
  // Événements
  const baseTime = new Date(selectedDate.value).getTime();
  const dayMs = 24 * 3600 * 1000;
  
  events.value.forEach(event => {
    const eventTime = event.timestamp - baseTime;
    const x = (eventTime / dayMs) * width;
    
    ctx.fillStyle = 
      event.type === 'alert' ? '#e94560' :
      event.type === 'motion' ? '#16c79a' :
      '#f39c12';
    
    ctx.beginPath();
    ctx.arc(x, height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  });
};

const handleTimelineClick = (e) => {
  if (!timelineCanvas.value) return;
  
  const rect = timelineCanvas.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  
  const ratio = x / width;
  const hour = Math.floor(ratio * 24);
  const minute = Math.floor((ratio * 24 * 60) % 60);
  
  console.log(`Clicked on ${hour}:${minute.toString().padStart(2, '0')}`);
};

watch(selectedDate, () => {
  loadEvents();
});

onMounted(() => {
  loadEvents();
  window.addEventListener('resize', drawTimeline);
});
</script>

<style scoped>
.timeline-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 70px);
}

.header {
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header h1 {
  font-size: 20px;
}

.timeline-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.date-input {
  flex: 1;
  text-align: center;
}

.events-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.timeline-events {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.event-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: var(--transition);
}

.event-item:active {
  transform: scale(0.98);
}

.event-item.motion {
  border-left-color: var(--color-success);
}

.event-item.alert {
  border-left-color: var(--color-error);
}

.event-item.recording {
  border-left-color: var(--color-warning);
}

.event-time {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  min-width: 70px;
}

.event-content {
  flex: 1;
}

.event-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.event-camera {
  font-weight: 500;
}

.event-type-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.event-type-badge.motion {
  background: rgba(22, 199, 154, 0.2);
  color: var(--color-success);
}

.event-type-badge.alert {
  background: rgba(233, 69, 96, 0.2);
  color: var(--color-error);
}

.event-type-badge.recording {
  background: rgba(243, 156, 18, 0.2);
  color: var(--color-warning);
}

.event-thumbnail {
  width: 100px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-background);
}

.event-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.timeline-graph {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-md);
}

.timeline-graph canvas {
  width: 100%;
  height: 60px;
  cursor: pointer;
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
