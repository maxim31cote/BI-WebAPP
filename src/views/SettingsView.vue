<template>
  <div class="settings-view">
    <div class="header">
      <h1>{{ t('settings.title') }}</h1>
    </div>

    <div class="settings-container">
      <div class="settings-section">
        <h2>{{ t('settings.general') }}</h2>
        
        <div class="setting-item">
          <div class="setting-label">
            <span>{{ t('settings.language') }}</span>
          </div>
          <select v-model="language" @change="changeLanguage" class="input">
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span>{{ t('settings.theme') }}</span>
          </div>
          <div class="theme-selector">
            <button
              v-for="theme in themes"
              :key="theme.value"
              @click="changeTheme(theme.value)"
              class="theme-btn"
              :class="{ active: settingsStore.theme === theme.value }"
            >
              {{ t(`settings.${theme.value}`) }}
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2>{{ t('settings.video') }}</h2>
        
        <div class="setting-item">
          <div class="setting-label">
            <span>{{ t('settings.quality') }}</span>
          </div>
          <div class="quality-selector">
            <button
              v-for="quality in qualities"
              :key="quality.value"
              @click="changeQuality(quality.value)"
              class="quality-btn"
              :class="{ active: settingsStore.videoQuality === quality.value }"
            >
              {{ t(`settings.${quality.value}`) }}
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2>{{ t('settings.about') }}</h2>
        
        <div class="setting-item">
          <div class="setting-label">
            <span>{{ t('settings.version') }}</span>
          </div>
          <span class="setting-value">1.0.0</span>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span>Server</span>
          </div>
          <span class="setting-value">{{ authStore.server.host }}:{{ authStore.server.port }}</span>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span>{{ t('login.username') }}</span>
          </div>
          <span class="setting-value">{{ authStore.user?.username }}</span>
        </div>
      </div>

      <div class="settings-actions">
        <button @click="handleLogout" class="btn btn-primary btn-block">
          {{ t('settings.logout') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';

const { t, locale } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const language = ref(locale.value);

const themes = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'auto', label: 'Auto' }
];

const qualities = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const changeLanguage = () => {
  locale.value = language.value;
  settingsStore.setLanguage(language.value);
};

const changeTheme = (theme) => {
  settingsStore.setTheme(theme);
};

const changeQuality = (quality) => {
  settingsStore.setVideoQuality(quality);
};

const handleLogout = async () => {
  if (confirm(t('settings.confirmLogout'))) {
    await authStore.logout();
    router.push('/login');
  }
};
</script>

<style scoped>
.settings-view {
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

.settings-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.settings-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}

.settings-section h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
  color: var(--color-accent);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-border);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label span {
  font-size: 14px;
  font-weight: 500;
}

.setting-value {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.setting-item select {
  width: 150px;
}

.theme-selector,
.quality-selector {
  display: flex;
  gap: var(--spacing-sm);
}

.theme-btn,
.quality-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 13px;
  transition: var(--transition);
}

.theme-btn.active,
.quality-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-background);
}

.settings-actions {
  padding: var(--spacing-md) 0;
}

.btn-block {
  width: 100%;
  padding: var(--spacing-md);
}

@media (max-width: 480px) {
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .setting-item select,
  .theme-selector,
  .quality-selector {
    width: 100%;
  }
}
</style>
