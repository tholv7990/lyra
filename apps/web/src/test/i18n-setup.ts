// Test setup: initialise i18next (English only) so components that call
// useTranslation()/t() render real strings instead of raw keys. No
// LanguageDetector here — tests run in the `node` environment with no window.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/locales/en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});
