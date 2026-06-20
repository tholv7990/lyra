import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { WorkspaceView, TransferPreview } from '@lyra/shared';
import { api } from '../lib/api';
import { IconButton } from './IconButton';
import { XIcon } from '../layout/icons';

interface Props {
  projectId: string;
  teamWorkspaces: WorkspaceView[];
  onClose: () => void;
}

export function MoveToTeamModal({ projectId, teamWorkspaces, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [targetId, setTargetId] = useState(teamWorkspaces[0]?.id ?? '');
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!targetId) return;
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    api<TransferPreview>(`/projects/${projectId}/transfer/preview`, {
      method: 'POST',
      body: JSON.stringify({ targetWorkspaceId: targetId }),
    })
      .then((p) => setPreview(p))
      .catch((err) => setPreviewError(err instanceof Error ? err.message : t('projects.transferPreviewFailed')))
      .finally(() => setPreviewLoading(false));
  }, [projectId, targetId, t]);

  async function confirm() {
    if (busy || !preview || preview.conflicts.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ targetWorkspaceId: targetId }),
      });
      onClose();
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.transferFailed'));
    } finally {
      setBusy(false);
    }
  }

  const targetName = teamWorkspaces.find((w) => w.id === targetId)?.name ?? '';
  const hasConflicts = (preview?.conflicts.length ?? 0) > 0;
  const missingKeys =
    preview ? preview.providers.filter((p) => !preview.targetHasKeys.includes(p)) : [];

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <IconButton
          className="dialog-close"
          icon={<XIcon width={15} height={15} />}
          label={t('common.close')}
          size="sm"
          onClick={onClose}
        />
        <h3>{t('projects.moveToTeamTitle')}</h3>
        <p>{t('projects.moveToTeamSub')}</p>

        <label className="field">
          <span>{t('projects.moveToTeamTarget')}</span>
          <select
            className="text-input"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {teamWorkspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>

        {previewLoading && <p className="empty">{t('common.loading')}</p>}
        {previewError && <p className="error">{previewError}</p>}

        {preview && (
          <div className="transfer-preview">
            <p className="transfer-bundle">
              {t('projects.transferBundle', {
                tasks: preview.taskCount,
                pipelines: preview.pipelines.length,
                prompts: preview.prompts.length,
              })}
            </p>

            {missingKeys.length > 0 && (
              <div className="transfer-warning">
                <strong>{t('projects.transferKeysWarning')}</strong>
                <ul>
                  {missingKeys.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}

            {preview.conflicts.length > 0 && (
              <div className="transfer-conflicts">
                <strong>{t('projects.transferConflictsTitle')}</strong>
                <ul>
                  {preview.conflicts.map((c, i) => (
                    <li key={i}><strong>{c.name}</strong>: {c.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {!hasConflicts && (
              <p className="transfer-warn-oneway">
                {t('projects.transferOneWayWarning', { team: targetName })}
              </p>
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={busy || previewLoading || !preview || hasConflicts}
            onClick={() => void confirm()}
          >
            {busy ? t('projects.transferring') : t('projects.transferConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
