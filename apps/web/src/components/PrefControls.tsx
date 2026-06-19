import { useTranslation } from 'react-i18next';
import { useLanguage, useTheme, type ThemePref } from '../lib/prefs';
import { LANG_LABELS, type Lang } from '../i18n';

// Language picker — a compact select (English / Tiếng Việt).
export function LanguageSelect({ className }: { className?: string }) {
  const { lang, setLang, supported } = useLanguage();
  return (
    <select
      className={className ?? 'text-input select-sm pref-lang'}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Language"
    >
      {supported.map((l) => (
        <option key={l} value={l}>
          {LANG_LABELS[l]}
        </option>
      ))}
    </select>
  );
}

// Small SVG flags (emoji flags don't render on Windows — they show as letters).
function FlagEN() {
  return (
    <svg className="pref-lang-flag" viewBox="0 0 30 20" aria-hidden>
      <clipPath id="uj">
        <rect width="30" height="20" rx="2.5" />
      </clipPath>
      <g clipPath="url(#uj)">
        <rect width="30" height="20" fill="#012169" />
        <path d="M0,0 30,20 M30,0 0,20" stroke="#fff" strokeWidth="4" />
        <path d="M0,0 30,20 M30,0 0,20" stroke="#C8102E" strokeWidth="2" />
        <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="6" />
        <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.5" />
      </g>
    </svg>
  );
}

function FlagVN() {
  return (
    <svg className="pref-lang-flag" viewBox="0 0 30 20" aria-hidden>
      <rect width="30" height="20" rx="2.5" fill="#da251d" />
      <path
        d="M15 4 L16.41 8.06 L20.71 8.15 L17.28 10.74 L18.53 14.85 L15 12.4 L11.47 14.85 L12.72 10.74 L9.29 8.15 L13.59 8.06 Z"
        fill="#ffff00"
      />
    </svg>
  );
}

// Compact header language control — flag + EN/VN, borderless. Two languages, so
// a click toggles between them.
export function LanguageToggleButton() {
  const { lang, setLang } = useLanguage();
  const isVi = lang === 'vi';
  return (
    <button
      type="button"
      className="pref-lang-toggle"
      onClick={() => setLang(isVi ? 'en' : 'vi')}
      title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
      aria-label="Language"
    >
      {isVi ? <FlagVN /> : <FlagEN />}
      <span className="pref-lang-code">{isVi ? 'VN' : 'EN'}</span>
    </button>
  );
}

// Appearance picker — a segmented System / Light / Dark control.
export function ThemeSegment() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const opts: { value: ThemePref; label: string }[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];
  return (
    <div className="pref-seg" role="group" aria-label={t('settings.appearance')}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`pref-seg-btn${theme === o.value ? ' active' : ''}`}
          aria-pressed={theme === o.value}
          onClick={() => setTheme(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Compact theme toggle for the top bar — one button that flips light/dark.
export function ThemeToggleButton() {
  const { setTheme, resolved } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="pref-theme-toggle"
      title={`${resolved === 'dark' ? 'Dark' : 'Light'} — switch to ${next}`}
      aria-label="Toggle theme"
      onClick={() => setTheme(next)}
    >
      {resolved === 'dark' ? (
        // sun
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
        </svg>
      ) : (
        // moon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
