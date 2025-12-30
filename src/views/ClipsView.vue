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
        {{ t(filter.label) }}
      </button>
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
          <div class="clip-thumbnail">
            <img :src="getClipThumbnail(clip)" :alt="clip.camera" @error="handleImageError" />
            <div class="clip-duration">{{ formatDuration(clip.duration) }}</div>
          </div>
          
          <div class="clip-info">
            <h3>{{ clip.camera }}</h3>
            <p class="clip-date">{{ formatDate(clip.date) }}</p>
            <div class="clip-meta">
              <span class="clip-size">{{ formatSize(clip.bytes) }}</span>
              <span v-if="clip.alert" class="clip-badge alert">{{ t('clips.alerts') }}</span>
              <span v-if="clip.motion" class="clip-badge motion">{{ t('clips.motion') }}</span>
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

    <!-- Modal de lecture -->
    <div v-if="playingClip" class="video-modal" @click="closePlayer">
      <div class="modal-content" @click.stop>
        <button @click="closePlayer" class="btn-close">×</button>
        <video
          ref="clipPlayer"
          controls
          autoplay
          class="clip-player"
          :src="getClipURL(playingClip)"
        ></video>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

const clips = ref([]);
const loading = ref(false);
const activeFilter = ref('all');
const playingClip = ref(null);
const clipPlayer = ref(null);

const filters = [
  { value: 'all', label: 'clips.all' },
  { value: 'alerts', label: 'clips.alerts' },
  { value: 'motion', label: 'clips.motion' }
];

const filteredClips = computed(() => {
  if (activeFilter.value === 'all') return clips.value;
  if (activeFilter.value === 'alerts') return clips.value.filter(c => c.alert);
  if (activeFilter.value === 'motion') return clips.value.filter(c => c.motion);
  return clips.value;
});

const loadClips = async () => {
  loading.value = true;
  const result = await authStore.apiClient.getClips();
  if (result.success) {
    clips.value = result.clips || [];
  }
  loading.value = false;
};

const playClip = (clip) => {
  playingClip.value = clip;
};

const closePlayer = () => {
  if (clipPlayer.value) {
    clipPlayer.value.pause();
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
  return `${authStore.baseURL}${clip.path}?session=${authStore.session}`;
};

const getClipThumbnail = (clip) => {
  // Utiliser une frame du clip comme thumbnail
  return `${authStore.baseURL}/image/${clip.camera}?session=${authStore.session}&w=320&h=180`;
};

const handleImageError = (e) => {
  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"%3E%3Crect fill="%23333" width="320" height="180"/%3E%3C/svg%3E';
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

const formatSize = (bytes) => {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

onMounted(() => {
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
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header h1 {
  font-size: 20px;
}

.filters {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
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

.clip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  font-size: 12px;
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

.loading,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
}
</style>
