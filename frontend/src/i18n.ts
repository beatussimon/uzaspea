import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    // Language detection order: localStorage first so user choice persists across reloads,
    // then navigator (browser language), then default 'en'.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'uzaspea_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
