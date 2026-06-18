import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GeneratedPipeline } from '@lyra/shared';
import { api } from '../lib/api';

interface Props {
  wsId: string;
  onClose: () => void;
}

// Describe a goal → the server designs a pipeline from your prompt library →
// the draft opens (editable) in the builder. Errors (no Anthropic key, empty
// library) surface inline from the api.
export function BuildWithAiModal({ wsId, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        body: JSON.stringify({ goal: goal.trim() }),
      });
      onClose();
      navigate('/pipelines/new', { state: { draft } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pipelines.generateError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog bwa" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>✨ {t('pipelines.buildWithAiTitle')}</h3>
        <p>{t('pipelines.buildWithAiHint')}</p>
        {error && <p className="error">{error}</p>}
        <textarea
          className="text-input bwa-goal"
          rows={4}
          autoFocus
          placeholder={t('pipelines.goalPlaceholder')}
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
            {busy ? t('pipelines.generating') : t('pipelines.generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
