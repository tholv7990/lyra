import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { LanguageToggleButton, ThemeToggleButton } from './PrefControls';

// Top bar for the public auth pages (login / signup / forgot / reset). Mirrors
// the landing nav — same BrandLogo + blurred bar + language/theme toggles — so
// the home and auth pages share one consistent header.
export function AuthTopBar() {
  return (
    <header className="auth-topbar">
      <div className="auth-topbar-inner">
        <Link to="/" className="auth-brand" aria-label="Lyra">
          <BrandLogo />
        </Link>
        <div className="auth-prefs">
          <LanguageToggleButton />
          <ThemeToggleButton />
        </div>
      </div>
    </header>
  );
}
