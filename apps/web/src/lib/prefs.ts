import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, type Lang } from '../i18n';

// ===== Theme =====
// "system" follows the OS (prefers-color-scheme); "light"/"dark" force a choice.
// The resolved light/dark value is reflected on <html data-theme>; the raw
// preference is persisted so "system" keeps tracking the OS after reload.
export type ThemePref = 'system' | 'light' | 'dark';
const THEME_KEY = 'lyra.theme';

export function getStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? systemTheme() : pref;
}

function applyTheme(pref: ThemePref): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    // Keep following the OS while in "system" mode.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (pref: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {
      // ignore
    }
    setThemeState(pref);
  };

  return { theme, setTheme, resolved: resolveTheme(theme) };
}

// ===== Language =====
// react-i18next + the browser detector handle persistence (localStorage 'lyra.lang')
// and the "follow browser unless overridden" default.
export function useLanguage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2) as Lang) ?? 'en';
  const setLang = (l: Lang) => void i18n.changeLanguage(l);
  return { lang, setLang, supported: SUPPORTED_LANGS };
}
