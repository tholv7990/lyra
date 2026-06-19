import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../workspace/useWorkspace';
import { initial } from '../lib/format';
import { useOutsideClick } from '../lib/useOutsideClick';
import { ChevronIcon, CheckIcon } from './icons';

export function WorkspaceMenu() {
  const { t } = useTranslation();
  const { workspaces, current, setCurrent, createWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useOutsideClick(ref, open, () => {
    setOpen(false);
    setCreating(false);
  });
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createWorkspace({ name: name.trim() });
      setName('');
      setCreating(false);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.couldNotCreateWorkspace'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws" ref={ref}>
      <button className="ws-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="ws-avatar">{initial(current?.name ?? 'W', 'W')}</span>
        <span className="ws-name">{current?.name ?? t('common.workspace')}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="ws-pop">
          {workspaces.map((w) => (
            <button
              key={w.id}
              className="ws-pop-item"
              onClick={() => {
                setCurrent(w.id);
                setOpen(false);
              }}
            >
              <span className="ws-avatar">{initial(w.name, 'W')}</span>
              <span className="ws-name">{w.name}</span>
              {w.type === 'personal' && <span className="tag">{t('common.personal')}</span>}
              {w.id === current?.id && <CheckIcon />}
            </button>
          ))}

          <div className="ws-pop-divider" />

          {creating ? (
            <form className="ws-create" onSubmit={onCreate}>
              <input
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('common.workspaceName')}
                autoFocus
              />
              {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" type="submit" disabled={busy} style={{ flex: 1, marginTop: 0 }}>
                  {busy ? t('common.creating') : t('common.create')}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button className="ws-pop-item" onClick={() => setCreating(true)}>
              <span className="ws-avatar" style={{ background: 'var(--surface-3)', color: 'var(--ink)' }}>
                +
              </span>
              <span className="ws-name">{t('common.newTeamWorkspace')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
