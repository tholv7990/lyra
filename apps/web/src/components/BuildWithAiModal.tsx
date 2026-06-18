import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GeneratedPipeline, PipelineStepInput } from '@lyra/shared';
import { api } from '../lib/api';

interface Props {
  wsId: string;
  onClose: () => void;
  // Revise mode ("Edit with AI"): the current steps to rewrite. When set with
  // onApply, the draft is applied to the open builder instead of starting a new
  // pipeline.
  current?: PipelineStepInput[];
  onApply?: (draft: GeneratedPipeline) => void;
}

// Describe a goal → the server designs (or revises) a pipeline from your prompt
// library → the draft opens (or updates) editable in the builder. Errors (no
// Anthropic key, empty library) surface inline from the api.
export function BuildWithAiModal({ wsId, onClose, current, onApply }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editMode = !!onApply;
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!goal.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api<GeneratedPipeline>(`/workspaces/${wsId}/pipelines/generate`, {
        method: 'POST',
        body: JSON.stringify({ goal: goal.trim(), ...(current ? { current } : {}) }),
      });
      if (onApply) {
        // Edit mode: apply the revision to the open builder.
        onApply(draft);
        onClose();
      } else {
        // Create mode: navigate first (carrying the draft), then close.
        navigate('/pipelines/new', { state: { draft } });
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pipelines.generateError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog bwa" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>✨ {t(editMode ? 'pipelines.editWithAiTitle' : 'pipelines.buildWithAiTitle')}</h3>
        <p>{t(editMode ? 'pipelines.editWithAiHint' : 'pipelines.buildWithAiHint')}</p>
        {error && <p className="error">{error}</p>}
        <textarea
          className="text-input bwa-goal"
          rows={4}
          autoFocus
          placeholder={t(editMode ? 'pipelines.editGoalPlaceholder' : 'pipelines.goalPlaceholder')}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void generate();
          }}
        />
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={busy || !goal.trim()}
            onClick={() => void generate()}
          >
            {busy
              ? t('pipelines.generating')
              : t(editMode ? 'pipelines.revise' : 'pipelines.generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
