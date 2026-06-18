import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StepMode, type Asset, type Step } from '@lyra/shared';
import { api, downloadFile } from '../lib/api';
import { XIcon } from '../layout/icons';

// One past execution of this step (per-run history). Assets are fetched lazily
// when a version is selected; only the text/status travel in the list.
export interface StepHistoryEntry {
  runId: string;
  createdAt: string;
  status: string;
  result?: string;
  error?: string;
}

interface StepResultModalProps {
  // The run the live step belongs to (for downloads of the current version).
  runId: string;
  step: Step;
  // The current step's assets (already loaded by the run view).
  assets: Asset[];
  // What fed into the step (previous step's output / the run note).
  input?: string;
  // Prior runs of the same pipeline for this step, newest first.
  history?: StepHistoryEntry[];
  onClose: () => void;
}

// "1.4s" / "850ms" between two ISO timestamps, or null if not both present.
function duration(startedAt?: string, finishedAt?: string): string | null {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

interface Version {
  key: string;
  runId: string;
  status: string;
  result?: string;
  error?: string;
  label: string;
}

// A focused, result-only view of a single step — decoupled from the prompt.
// Shows the output text (copyable), any image/video/audio inline, per-file and
// zip downloads, and a per-run version switcher when the step has history.
export function StepResultModal({ runId, step, assets, input, history = [], onClose }: StepResultModalProps) {
  const { t } = useTranslation();
  const title = step.name?.trim() || t('run.step', { n: step.index + 1 });
  const provider = step.provider ?? '';
  const promptSent = (step.sentPrompt || step.prompt || '').trim();
  const dur = duration(step.startedAt, step.finishedAt);
  const tokens = step.usage?.tokens;

  const versions = useMemo<Version[]>(
    () => [
      { key: 'current', runId, status: step.status, result: step.result, error: step.error, label: t('run.thisRun') },
      ...history.map((h) => ({
        key: h.runId,
        runId: h.runId,
        status: h.status,
        result: h.result,
        error: h.error,
        label: new Date(h.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      })),
    ],
    [runId, step, history],
  );

  const [sel, setSel] = useState(0);
  const current = versions[Math.min(sel, versions.length - 1)];

  // Assets per version: the current run's are already in hand; older runs are
  // fetched on demand and cached. `undefined` = not yet loaded.
  const [assetCache, setAssetCache] = useState<Record<string, Asset[]>>({ [runId]: assets });
  const shownAssets = assetCache[current.runId];

  useEffect(() => {
    if (assetCache[current.runId]) return;
    let alive = true;
    api<Asset[]>(`/runs/${current.runId}/assets`)
      .then((list) => {
        if (alive) {
          setAssetCache((c) => ({ ...c, [current.runId]: list.filter((a) => a.stepIndex === step.index) }));
        }
      })
      .catch(() => {
        if (alive) setAssetCache((c) => ({ ...c, [current.runId]: [] }));
      });
    return () => {
      alive = false;
    };
  }, [current.runId, step.index, assetCache]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(current.result ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — no-op
    }
  }

  const dlOne = (assetId: string, name: string) =>
    void downloadFile(`/runs/${current.runId}/assets/${assetId}/download`, name);
  const dlZip = () =>
    void downloadFile(
      `/runs/${current.runId}/assets/zip?step=${step.index}`,
      `step-${step.index + 1}-assets.zip`,
    );

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog srm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="srm-head">
          <div className="srm-title">
            <span className="srm-num">{step.index + 1}</span>
            <h3>{title}</h3>
            <span className={`badge status-${current.status}`}>
              {t(`run.status_${current.status}`)}
            </span>
          </div>
          <div className="srm-meta">
            {provider && <span className="srm-pm">{provider} · {step.model}</span>}
            <button type="button" className="srm-x" onClick={onClose} aria-label={t('common.close')}>
              <XIcon width={15} height={15} />
            </button>
          </div>
        </div>

        <div className="srm-metastrip">
          <span className={`mode-tag ${step.mode === StepMode.Gate ? 'gate' : 'auto'}`}>
            {step.mode === StepMode.Gate ? t('run.gate') : t('run.auto')}
          </span>
          {typeof tokens === 'number' && tokens > 0 && (
            <span className="srm-meta-chip">{t('run.tokens', { n: tokens })}</span>
          )}
          {dur && <span className="srm-meta-chip">{dur}</span>}
        </div>

        {versions.length > 1 && (
          <div className="srm-versions">
            <span className="srm-versions-label">{t('run.version')}</span>
            <select
              className="srm-version-select"
              value={Math.min(sel, versions.length - 1)}
              onChange={(e) => setSel(Number(e.target.value))}
            >
              {versions.map((v, i) => (
                <option key={v.key} value={i}>
                  {v.label}
                  {i === 0 ? ` · ${t('run.latest')}` : ''}
                </option>
              ))}
            </select>
            <span className="srm-version-count">{t('run.runsCount', { n: versions.length })}</span>
          </div>
        )}

        <div className="srm-body">
          {shownAssets === undefined ? (
            <div className="srm-media-loading">{t('run.loadingMedia')}</div>
          ) : shownAssets.length > 0 ? (
            <div className="srm-media">
              <div className="srm-media-bar">
                <span>{t('run.files', { count: shownAssets.length })}</span>
                <button type="button" className="btn-ghost srm-dl-all" onClick={dlZip}>
                  {t('run.downloadAll')}
                </button>
              </div>
              <div className="srm-media-grid">
                {shownAssets.map((a) => (
                  <div className="srm-asset" key={a.id}>
                    {a.type === 'image' ? (
                      <a href={a.url} target="_blank" rel="noreferrer" title={t('run.openFullSize')}>
                        <img src={a.thumbUrl || a.url} alt="" loading="lazy" />
                      </a>
                    ) : a.type === 'video' ? (
                      <video src={a.url} controls preload="metadata" />
                    ) : (
                      <audio src={a.url} controls />
                    )}
                    <button
                      type="button"
                      className="srm-asset-dl"
                      onClick={() => dlOne(a.id, fallbackName(a, step.index))}
                    >
                      {t('common.download')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {current.error ? (
            <>
              <div className="srm-result-bar">
                <span>{t('common.error')}</span>
              </div>
              <pre className="srm-result srm-error">{current.error}</pre>
            </>
          ) : current.result ? (
            <>
              <div className="srm-result-bar">
                <span>{t('run.output')}</span>
                <button type="button" className="btn-ghost srm-copy" onClick={copy}>
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <pre className="srm-result">{current.result}</pre>
            </>
          ) : shownAssets && shownAssets.length === 0 ? (
            <p className="srm-empty">{t('run.noResult')}</p>
          ) : null}

          {/* Full detail for the current run: the exact prompt sent + the input. */}
          {current.key === 'current' && promptSent && (
            <details className="srm-section">
              <summary>{t('run.promptSent')}</summary>
              <pre className="srm-result srm-section-pre">{promptSent}</pre>
            </details>
          )}
          {current.key === 'current' && input?.trim() && (
            <details className="srm-section">
              <summary>{t('run.input')}</summary>
              <pre className="srm-result srm-section-pre">{input}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// A client-side fallback filename (the server's Content-Disposition usually wins).
function fallbackName(asset: Asset, stepIndex: number): string {
  try {
    const seg = new URL(asset.url).pathname.split('/').filter(Boolean).pop();
    if (seg && /\.[a-z0-9]{2,4}$/i.test(seg)) return decodeURIComponent(seg);
  } catch {
    // not a URL
  }
  const ext = asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'mp3' : 'png';
  return `step-${stepIndex + 1}-asset.${ext}`;
}
