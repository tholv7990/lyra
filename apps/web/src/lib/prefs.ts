import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANG_STORAGE_KEY, SUPPORTED_LANGS, type Lang } from '../i18n';

// ===== Theme =====
// The resolved light/dark value is reflected on <html data-theme> and persisted
// so public and authenticated pages share the same appearance.
export type ThemePref = 'light' | 'dark';
const THEME_KEY = 'lyra.theme';
const THEME_EVENT = 'lyra-theme-change';

export function getStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
    if (v === 'system') return systemTheme();
  } catch {
    // localStorage unavailable
  }
  return systemTheme();
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref;
}

function applyTheme(pref: ThemePref): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

function persistTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // ignore
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>(getStoredTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => setThemeState(getStoredTheme());
    window.addEventListener('storage', syncTheme);
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => {
      window.removeEventListener('storage', syncTheme);
      window.removeEventListener(THEME_EVENT, syncTheme);
    };
  }, []);

  const setTheme = (pref: ThemePref) => {
    persistTheme(pref);
    applyTheme(pref);
    setThemeState(pref);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return { theme, setTheme, resolved: resolveTheme(theme) };
}

// ===== Language =====
// react-i18next + the browser detector handle persistence (localStorage 'lyra.lang')
// and the "follow browser unless overridden" default.
export function useLanguage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2) as Lang) ?? 'en';
  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);
  const setLang = (l: Lang) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // ignore
    }
    void i18n.changeLanguage(l);
  };
  return { lang, setLang, supported: SUPPORTED_LANGS };
}
