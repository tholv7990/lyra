import { useTranslation } from 'react-i18next';
import type { ProjectStatus, PromptStatus } from '@lyra/shared';
import { STATUS_LABEL_KEY } from '../lib/constants';

/**
 * The Draft/Public status badge. Owns the `badge status-${status}` markup and
 * the label, backed by the shared `STATUS_LABEL_KEY` — replacing the
 * `<span className={`badge status-${x}`}>` + per-page label map (`STATUS_KEY`,
 * `PROJECT_STATUS_KEY`, a local `statusLabel`) that was duplicated across the
 * prompt and project surfaces.
 */
export function StatusPill({ status }: { status: PromptStatus | ProjectStatus }) {
  const { t } = useTranslation();
  return <span className={`badge status-${status}`}>{t(STATUS_LABEL_KEY[status])}</span>;
}
