import { createI18n } from 'vue-i18n';
import en from './en';
import fr from './fr';

// Détection automatique de la langue
const getBrowserLocale = () => {
  const lang = navigator.language || navigator.userLanguage;
  return lang.split('-')[0]; // 'en-US' -> 'en'
};

const savedLocale = localStorage.getItem('locale');
const browserLocale = getBrowserLocale();
const defaultLocale = savedLocale || browserLocale || 'en';

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    fr
  }
});

export default i18n;
