import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskPriority } from '@lyra/shared';
import { TASK_PRIORITY_ORDER } from '../lib/taskPriority';
import { useOutsideClick } from '../lib/useOutsideClick';
import { TaskPriorityIcon } from './TaskPriorityIcon';

// Linear-style priority control: an icon + label trigger that opens a menu of
// priorities. Reuses the status picker's button/menu styles.
export function TaskPriorityPicker({
  priority,
  disabled,
  onChange,
}: {
  priority: TaskPriority;
  disabled?: boolean;
  onChange: (p: TaskPriority) => void;
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
        aria-label={t('tasks.priorityLabel')}
        onClick={() => setOpen((o) => !o)}
      >
        <TaskPriorityIcon priority={priority} size={15} />
        {t(`tasks.priority.${priority}`)}
      </button>
      {open && (
        <div className="lin-menu task-status-menu" role="menu">
          {TASK_PRIORITY_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitemradio"
              aria-checked={p === priority}
              className="lin-menu-item"
              onClick={() => { onChange(p); setOpen(false); }}
            >
              <TaskPriorityIcon priority={p} size={15} />
              {t(`tasks.priority.${p}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
