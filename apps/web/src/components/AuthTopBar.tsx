import { LanguageToggleButton, ThemeToggleButton } from './PrefControls';

// Floating top-right controls for the public auth pages (login / signup / forgot
// / reset). The landing has these in its nav, but a user who lands directly on an
// auth page otherwise has no way to switch theme or language — so they live here
// too. They write the same persisted prefs (lib/prefs.ts), so the choice carries
// across the whole app.
export function AuthTopBar() {
  return (
    <div className="auth-prefs">
      <LanguageToggleButton />
      <ThemeToggleButton />
    </div>
  );
}
