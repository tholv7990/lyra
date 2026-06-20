import type { PipelineVariable } from '@lyra/shared';
import { useTranslation } from 'react-i18next';

// Define a pipeline's custom variables (key / label / default). Each is
// referenced in step prompts as {key}; its value is entered when a run starts.
export function PipelineVarsEditor({
  variables,
  disabled,
  onChange,
}: {
  variables: PipelineVariable[];
  disabled?: boolean;
  onChange: (v: PipelineVariable[]) => void;
}) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<PipelineVariable>) =>
    onChange(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const remove = (i: number) => onChange(variables.filter((_, idx) => idx !== i));
  const add = () => onChange([...variables, { key: '', label: '', default: '' }]);

  // No variables yet → collapse to a single compact control (saves vertical space).
  if (variables.length === 0) {
    if (disabled) return null;
    return (
      <button
        className="btn-ghost pvars-add pvars-empty btn-inline"
        onClick={add}
        title={t('common.defineVariableTitle')}
      >
        + {t('common.addVariable')}
      </button>
    );
  }

  return (
    <div className="pvars">
      <div className="pvars-head">
        <span className="pvars-title">{t('common.variables')}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {t('common.useInStepPromptsAs')} <code>{'{key}'}</code> · {t('common.valuesEnteredAtRunStart')}
        </span>
      </div>
      {variables.map((v, i) => (
        <div key={i} className="pvars-row">
          <input
            className="text-input"
            placeholder={t('common.key')}
            value={v.key}
            disabled={disabled}
            onChange={(e) => update(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
          />
          <input
            className="text-input"
            placeholder={t('common.labelOptional')}
            value={v.label ?? ''}
            disabled={disabled}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            className="text-input"
            placeholder={t('common.defaultOptional')}
            value={v.default ?? ''}
            disabled={disabled}
            onChange={(e) => update(i, { default: e.target.value })}
          />
          {!disabled && (
            <button className="icon-mini danger" title={t('common.removeVariable')} onClick={() => remove(i)}>
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button className="btn-ghost pvars-add btn-inline" onClick={add}>
          + {t('common.addVariable')}
        </button>
      )}
    </div>
  );
}
