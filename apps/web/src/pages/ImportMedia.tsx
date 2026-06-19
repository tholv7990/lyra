import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, MediaQuality } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { downloadFile } from '../lib/api';
import { RefreshIcon } from '../layout/icons';
import './connectors.css';

const TYPE_GLYPH: Record<MediaItem['type'], string> = { video: '▶', image: '🖼', audio: '♪' };

export interface FetchButtonStateInput {
  hasWorkspace: boolean;
  workspaceLoading: boolean;
  url: string;
  busy: boolean;
}

export function fetchButtonState(input: FetchButtonStateInput) {
  const waiting = input.busy || input.workspaceLoading;
  return {
    disabled: waiting || !input.hasWorkspace || !input.url.trim(),
    labelKey: waiting ? 'loading' : 'fetch',
    spin: waiting,
    ...(input.workspaceLoading
      ? { statusKey: 'preparingWorkspace' }
      : input.busy
        ? { statusKey: 'resolvingMedia' }
        : {}),
  } as const;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Default download quality: the highest rung ≤720p (keeps files small/fast), else
// the lowest available video rung, else the first option. Qualities arrive sorted
// high→low. Pure — exported for a cheap unit check.
export function defaultQualityFormat(qualities?: MediaQuality[]): string | undefined {
  if (!qualities?.length) return undefined;
  const vids = qualities.filter((q) => q.height);
  return (vids.find((q) => q.height! <= 720) ?? vids[vids.length - 1] ?? qualities[0]).format;
}

const mb = (b?: number) => (b ? ` · ~${Math.round(b / 1e6)} MB` : '');

// Built-ins → Import media. Paste a social link → Cobalt (via the proxy) resolves
// it → preview the items → download. Mock-backed until the microservice exists.
export function ImportMedia() {
  const { t } = useTranslation();
  const { current, loading: workspaceLoading } = useWorkspace();
  const ws = current?.id;

  const [url, setUrl] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [fetched, setFetched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<number, string>>({}); // item index → chosen -f selector
  const [dl, setDl] = useState<Record<number, number>>({}); // index → download % in flight; key -1 = "download all"

  const fetchState = fetchButtonState({
    hasWorkspace: Boolean(ws),
    workspaceLoading,
    url,
    busy,
  });

  const fetchMedia = () => {
    if (fetchState.disabled || !ws) return;
    setBusy(true);
    setError(null);
    connectorsApi
      .resolve(ws, url.trim())
      .then((r) => { setItems(r.items); setFetched(true); })
      .catch((err) => setError(err instanceof Error ? err.message : t('connectors.error')))
      .finally(() => setBusy(false));
  };

  const download = (indices?: number[], format?: string) => {
    if (!ws) return;
    const tag = indices ?? [-1]; // -1 marks the "download all" action
    const setPct = (pct: number) => setDl((d) => ({ ...d, ...Object.fromEntries(tag.map((i) => [i, pct])) }));
    const clear = () => setDl((d) => { const n = { ...d }; tag.forEach((i) => delete n[i]); return n; });
    const fail = (err: unknown) => { setError(err instanceof Error ? err.message : t('connectors.error')); clear(); };
    setPct(0);
    setError(null);
    // Poll the job ~every 0.8s for live progress; on done, save the file(s).
    const poll = (jobId: string) =>
      connectorsApi
        .downloadJob(ws, jobId)
        .then((job) => {
          if (job.status === 'running') { setPct(job.pct); window.setTimeout(() => poll(jobId), 800); }
          else if (job.status === 'done') {
            job.items?.forEach((it) =>
              it.url.startsWith('http')
                ? triggerDownload(it.url, it.filename)    // absolute (mock/external)
                : void downloadFile(it.url, it.filename), // proxied Lyra file (authed)
            );
            clear();
          } else fail(new Error(job.error ?? t('connectors.error')));
        })
        .catch(fail);
    connectorsApi.startDownload(ws, url.trim(), indices, format).then(({ jobId }) => poll(jobId)).catch(fail);
  };

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.importTitle')}</h2>
      <p className="cx-sub">{t('connectors.importSubtitle')}</p>

      <div className="cx-bar">
        <input
          className="cx-url"
          placeholder={t('connectors.urlPlaceholder')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') fetchMedia(); }}
        />
        <button
          className="cx-btn-primary cx-fetch-btn"
          disabled={fetchState.disabled}
          aria-busy={fetchState.spin}
          onClick={fetchMedia}
        >
          {fetchState.spin && <RefreshIcon className="cx-spin" />}
          {t(`connectors.${fetchState.labelKey}`)}
        </button>
      </div>
      {fetchState.statusKey && <p className="cx-status">{t(`connectors.${fetchState.statusKey}`)}</p>}
      <div className="cx-plats">{t('connectors.supported')}</div>
      {error && <p className="cx-error">{error}</p>}

      {items.length > 0 && (
        <div className="cx-section">
          <div className="cx-sec-head">
            <span className="cx-sec-title">{t('connectors.resolved', { count: items.length })}</span>
          </div>
          <div className="cx-mgrid">
            {items.map((it) => {
              const pct = dl[it.index] ?? dl[-1];
              const tileBusy = pct !== undefined;
              const chosen = pick[it.index] ?? defaultQualityFormat(it.qualities);
              return (
                <div className="cx-tile" key={it.index}>
                  <span className="cx-tbadge">{it.type.toUpperCase()}</span>
                  <div className="cx-mthumb">{it.thumbUrl ? <img src={it.thumbUrl} alt="" /> : TYPE_GLYPH[it.type]}</div>
                  <div className="cx-tfoot">
                    <span className="cx-tname">{it.filename ?? `item-${it.index}`}</span>
                    <div className="cx-tactions">
                      {tileBusy ? (
                        <>
                          <progress className="cx-prog" max={100} value={pct} aria-label={t('connectors.downloading')} />
                          <span className="cx-pct">{Math.round(pct)}%</span>
                        </>
                      ) : (
                        <>
                          {it.qualities?.length ? (
                            <select
                              className="cx-qsel"
                              value={chosen}
                              aria-label={t('connectors.quality')}
                              onChange={(e) => setPick((p) => ({ ...p, [it.index]: e.target.value }))}
                            >
                              {it.qualities.map((q) => (
                                <option key={q.format} value={q.format}>
                                  {(q.height ? q.label : t('connectors.audioOnly')) + mb(q.approxBytes)}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <button className="cx-tdl" title={t('connectors.download')} onClick={() => download([it.index], chosen)}>↓</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cx-foot">
            <span className="cx-gate">⚠️ {t('connectors.tosNote')}</span>
            <button className="cx-btn" disabled={Object.keys(dl).length > 0} onClick={() => download()}>
              {dl[-1] !== undefined
                ? `${t('connectors.downloadAll')} · ${Math.round(dl[-1])}%`
                : t('connectors.downloadAll')}
            </button>
          </div>
        </div>
      )}

      {fetched && items.length === 0 && <p className="cx-empty">{t('connectors.nothingResolved')}</p>}
    </div>
  );
}
