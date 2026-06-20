import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskStatus } from '@lyra/shared';
import { TASK_STATUS_ORDER } from '../lib/taskStatus';
import { useOutsideClick } from '../lib/useOutsideClick';
import { TaskStatusIcon } from './TaskStatusIcon';

// Linear-style status control: a trigger showing the current state's icon + label
// that opens a menu of states (icon + label rows). Replaces the native <select>.
export function TaskStatusPicker({
  status,
  disabled,
  onChange,
}: {
  status: TaskStatus;
  disabled?: boolean;
  onChange: (s: TaskStatus) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  return (
    <div className="task-status-wrap" ref={ref}>
      <button
        type="button"
        className="task-status-btn"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('tasks.statusLabel')}
        onClick={() => setOpen((o) => !o)}
      >
        <TaskStatusIcon status={status} size={15} />
        {t(`tasks.status.${status}`)}
      </button>
      {open && (
        <div className="lin-menu task-status-menu" role="menu">
          {TASK_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === status}
              className="lin-menu-item"
              onClick={() => { onChange(s); setOpen(false); }}
            >
              <TaskStatusIcon status={s} size={15} />
              {t(`tasks.status.${s}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
