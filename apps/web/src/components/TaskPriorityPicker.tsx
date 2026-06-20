import { useTranslation } from 'react-i18next';
import { TaskPriority } from '@lyra/shared';
import { TASK_PRIORITY_ORDER } from '../lib/taskPriority';
import { TaskPriorityIcon } from './TaskPriorityIcon';
import { MenuPicker } from './MenuPicker';

// Linear-style priority control over the shared MenuPicker.
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
  return (
    <MenuPicker
      value={priority}
      onChange={onChange}
      disabled={disabled}
      ariaLabel={t('tasks.priorityLabel')}
      options={TASK_PRIORITY_ORDER.map((p) => ({
        value: p,
        label: t(`tasks.priority.${p}`),
        icon: <TaskPriorityIcon priority={p} size={15} />,
      }))}
    />
  );
}
