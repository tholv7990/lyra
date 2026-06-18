import { useTranslation } from 'react-i18next';
import type { RunRating as RunRatingValue } from '@lyra/shared';

interface RunRatingProps {
  value?: RunRatingValue;
  disabled?: boolean;
  onRate: (value: 'up' | 'down' | null) => void;
}

// The toggle decision: clicking the active thumb clears it, otherwise sets it.
export function nextRating(
  current: 'up' | 'down' | undefined,
  clicked: 'up' | 'down',
): 'up' | 'down' | null {
  return current === clicked ? null : clicked;
}

// Per-run thumbs: 👍 / 👎 reflecting the run's overall rating. Pure presentational —
// the page owns the API call (server is the source of truth).
export function RunRating({ value, disabled, onRate }: RunRatingProps) {
  const { t } = useTranslation();
  const current = value?.value;
  return (
    <div className="run-rating" role="group" aria-label={t('run.rate')}>
      <button
        type="button"
        className={`run-rating-btn${current === 'up' ? ' active' : ''}`}
        disabled={disabled}
        aria-pressed={current === 'up'}
        title={t('run.rateUp')}
        onClick={() => onRate(nextRating(current, 'up'))}
      >
        👍
      </button>
      <button
        type="button"
        className={`run-rating-btn${current === 'down' ? ' active' : ''}`}
        disabled={disabled}
        aria-pressed={current === 'down'}
        title={t('run.rateDown')}
        onClick={() => onRate(nextRating(current, 'down'))}
      >
        👎
      </button>
    </div>
  );
}
