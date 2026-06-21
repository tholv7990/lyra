import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  ProjectsIcon,
  PromptsIcon,
  PipelinesIcon,
  ComponentsIcon,
  MarketplaceIcon,
  SettingsIcon,
  PlusIcon,
} from '../layout/icons';
import { useScrollLock } from '../lib/useScrollLock';

interface CommandAction {
  id: string;
  group: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
}

// Linear-style ⌘K command palette: a search input + grouped command rows
// (icon · label · shortcut), keyboard-navigable, opened anywhere with ⌘/Ctrl+K.
// Rendered once at the app shell. Token-only; keeps our orange + light brand.
export function CommandBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('lyra:command-bar', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('lyra:command-bar', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSel(0);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  useScrollLock(open);

  const goTo = (name: string) => t('common.goToNamed', { name });
  const actions: CommandAction[] = useMemo(
    () => [
      { id: 'home', group: t('common.navigate'), label: goTo(t('nav.home')), icon: <HomeIcon />, run: () => navigate('/') },
      { id: 'projects', group: t('common.navigate'), label: goTo(t('nav.projects')), icon: <ProjectsIcon />, run: () => navigate('/projects') },
      { id: 'prompts', group: t('common.navigate'), label: goTo(t('nav.prompts')), icon: <PromptsIcon />, run: () => navigate('/prompts') },
      { id: 'pipelines', group: t('common.navigate'), label: goTo(t('nav.pipelines')), icon: <PipelinesIcon />, run: () => navigate('/pipelines') },
      { id: 'marketplace', group: t('common.navigate'), label: goTo(t('nav.marketplace')), icon: <MarketplaceIcon />, run: () => navigate('/marketplace') },
      { id: 'components', group: t('common.navigate'), label: goTo(t('nav.components')), icon: <ComponentsIcon />, run: () => navigate('/components') },
      { id: 'settings', group: t('common.navigate'), label: goTo(t('nav.settings')), icon: <SettingsIcon />, run: () => navigate('/settings') },
      { id: 'newproject', group: t('common.create'), label: t('projects.newProject'), icon: <PlusIcon />, shortcut: 'P', run: () => navigate('/projects/new') },
    ],
    [navigate, t],
  );

  const flat = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
  }, [actions, query]);

  const groups = useMemo(() => {
    const out: { group: string; items: CommandAction[] }[] = [];
    for (const a of flat) {
      const last = out[out.length - 1];
      if (last && last.group === a.group) last.items.push(a);
      else out.push({ group: a.group, items: [a] });
    }
    return out;
  }, [flat]);

  if (!open) return null;

  const close = () => setOpen(false);
  const runAt = (i: number) => {
    const a = flat[i];
    if (a) { a.run(); close(); }
  };

  return (
    <div className="cmdbar-scrim" onMouseDown={close}>
      <div className="cmdbar" role="dialog" aria-modal="true" aria-label={t('common.commandPlaceholder')} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdbar-input"
          placeholder={t('common.commandPlaceholder')}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); runAt(sel); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
          }}
        />
        <div className="cmdbar-list">
          {flat.length === 0 ? (
            <div className="cmdbar-empty">{t('common.commandNoResults')}</div>
          ) : (
            groups.map(({ group, items }) => (
              <div className="cmdbar-group" key={group}>
                <div className="cmdbar-grouplabel">{group}</div>
                {items.map((a) => {
                  const i = flat.indexOf(a);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`cmdbar-row${i === sel ? ' active' : ''}`}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => runAt(i)}
                    >
                      <span className="cmdbar-ic">{a.icon}</span>
                      <span className="cmdbar-label">{a.label}</span>
                      {a.shortcut && <kbd className="cmdbar-kbd">{a.shortcut}</kbd>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
