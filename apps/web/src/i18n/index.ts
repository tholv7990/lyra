import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import vi from './locales/vi';

export const SUPPORTED_LANGS = ['en', 'vi'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

// localStorage key the detector reads/writes — keep in sync with usePreferences.
export const LANG_STORAGE_KEY = 'lyra.lang';

// Single 'translation' namespace with nested keys per area (common.*, nav.*, …).
// "Follow system, remember override": the detector uses the saved choice if any,
// else the browser language (vi-* -> vi, anything else -> en via fallback).
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnNull: false,
  });

export default i18n;
