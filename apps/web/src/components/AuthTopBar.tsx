import { Link } from 'react-router-dom';
import { LanguageToggleButton, ThemeToggleButton } from './PrefControls';

// Top bar for the public auth pages (login / signup / forgot / reset): the Lyra
// brand on the left, language + theme toggles on the right. The toggles write the
// same persisted prefs (lib/prefs.ts), so the choice carries across the app.
export function AuthTopBar() {
  return (
    <header className="auth-topbar">
      <Link to="/" className="auth-brand" aria-label="Lyra home">
        <img
          src="/lyra-mark-squircle.svg"
          alt=""
          className="auth-brand-mark"
          width={28}
          height={28}
        />
        <span className="auth-brand-name">Lyra</span>
      </Link>
      <div className="auth-prefs">
        <LanguageToggleButton />
        <ThemeToggleButton />
      </div>
    </header>
  );
}
