import { Corner, ActionType, type ActionStep } from '@lyra/shared';

type BrandAction = Extract<ActionStep, { type: ActionType.Brand }>;
// 3x3 grid: 4 corners + center; the other cells stay empty.
const GRID: (Corner | null)[] = [
  Corner.TL, null, Corner.TR,
  null, Corner.Center, null,
  Corner.BL, null, Corner.BR,
];
const SIZES: BrandAction['size'][] = ['sm', 'md', 'lg'];

export function BrandStepFields({ action, onChange, t }: {
  action: BrandAction;
  onChange: (a: BrandAction) => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  return (
    <div className="brand-fields">
      <div className="addstep-note">{t('pipelines.brandImageSource')}</div>

      <div className="pe-label">{t('pipelines.brandPosition')}</div>
      <div className="brand-corner-grid">
        {GRID.map((pos, i) =>
          pos ? (
            <button
              key={i}
              type="button"
              className={`brand-corner${action.position === pos ? ' selected' : ''}`}
              aria-pressed={action.position === pos}
              title={pos}
              onClick={() => onChange({ ...action, position: pos })}
            >
              <span className="brand-corner-dot" />
            </button>
          ) : (
            <span key={i} className="brand-corner empty" />
          ),
        )}
      </div>

      <div className="pe-label">{t('pipelines.brandSize')}</div>
      <div className="brand-size-seg">
        {SIZES.map((sz) => (
          <button
            key={sz}
            type="button"
            className={`brand-size${action.size === sz ? ' selected' : ''}`}
            aria-pressed={action.size === sz}
            onClick={() => onChange({ ...action, size: sz })}
          >
            {t(`pipelines.brandSize_${sz}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
