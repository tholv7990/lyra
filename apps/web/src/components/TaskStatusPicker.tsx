import { useTranslation } from 'react-i18next';
import { TaskStatus } from '@lyra/shared';
import { TASK_STATUS_ORDER } from '../lib/taskStatus';
import { TaskStatusIcon } from './TaskStatusIcon';
import { MenuPicker } from './MenuPicker';

// Linear-style status control over the shared MenuPicker.
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
  return (
    <MenuPicker
      value={status}
      onChange={onChange}
      disabled={disabled}
      ariaLabel={t('tasks.statusLabel')}
      options={TASK_STATUS_ORDER.map((s) => ({
        value: s,
        label: t(`tasks.status.${s}`),
        icon: <TaskStatusIcon status={s} size={15} />,
      }))}
    />
  );
}
