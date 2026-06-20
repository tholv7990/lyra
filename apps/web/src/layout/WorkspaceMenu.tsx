import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceType } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { initial } from '../lib/format';
import { useOutsideClick } from '../lib/useOutsideClick';
import { ChevronIcon, CheckIcon, MembersIcon, PersonIcon } from './icons';

// Workspace type marker: a team (group) or personal (single person) icon,
// shown next to the workspace name in the switcher.
function WsType({ type }: { type: WorkspaceType }) {
  const { t } = useTranslation();
  const label = type === WorkspaceType.Team ? t('common.teamWorkspace') : t('common.personalWorkspace');

  return (
    <span className="ws-type" title={label}>
      {type === WorkspaceType.Team ? <MembersIcon width={13} height={13} /> : <PersonIcon width={13} height={13} />}
    </span>
  );
}

export function WorkspaceMenu() {
  const { t } = useTranslation();
  const { workspaces, current, setCurrent } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useOutsideClick(ref, open, () => setOpen(false));
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

  return (
    <div className="ws" ref={ref}>
      <button className="ws-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="ws-avatar">{initial(current?.name ?? 'W', 'W')}</span>
        <span className="ws-name">{current?.name ?? t('common.workspace')}</span>
        {current && <WsType type={current.type} />}
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
              <WsType type={w.type} />
              {w.id === current?.id && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
