import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const SUPPORTED_LANGUAGES = [
  { code: 'sw', label: 'Kiswahili', nativeLabel: 'Kiswahili', flag: '🇹🇿', region: 'Tanzania' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸', region: 'International' },
  { code: 'fr', label: 'Français', nativeLabel: 'Français', flag: '🇫🇷', region: 'France' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文 (简体)', flag: '🇨🇳', region: 'China' },
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['sw', 'en', 'fr', 'zh'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          home: 'Home',
          products_nav: 'Products',
          help: 'Help',
          sell: 'Sell',
          login: 'Login',
          search: 'Search',
          light_mode: 'Light Mode',
          dark_mode: 'Dark Mode',
          renew_plan: 'Renew Plan',
          all_sellers_verified: 'All sellers on this platform are verified',
        }
      },
      sw: {
        translation: {
          home: 'Nyumbani',
          products_nav: 'Bidhaa',
          help: 'Msaada',
          sell: 'Uza',
          login: 'Ingia',
          search: 'Tafuta',
        }
      }
    },
    partialBundledLanguages: true,
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
    },
    react: {
      useSuspense: false // Prevents uncaught suspension bubbles in unbracketed layout components
    }
  });

export default i18n;

