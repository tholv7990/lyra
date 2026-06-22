import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, MediaQuality } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { downloadFile } from '../lib/api';
import { RefreshIcon } from '../layout/icons';
import { CrawlerCookies } from '../components/CrawlerCookies';
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

// Parse the multi-link textarea into a clean list: split on whitespace/commas,
// keep only http(s) links, dedupe (preserving order). Pure — unit-tested.
export function parseLinks(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of input.split(/[\s,]+/)) {
    const u = tok.trim();
    if (!u || !/^https?:\/\//i.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
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

// One resolved link: resolves on mount, previews its items, downloads them. Each
// instance is independent so several links run in parallel (the connectors service
// caps how many actually download at once).
function CrawlSource({ ws, url, showUrl }: { ws: string; url: string; showUrl: boolean }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<'resolving' | 'resolved' | 'error'>('resolving');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pick, setPick] = useState<Record<number, string>>({}); // item index → chosen -f selector
  const [dl, setDl] = useState<Record<number, number>>({}); // index → % in flight; key -1 = "download all"

  useEffect(() => {
    let alive = true;
    setStatus('resolving');
    setError(null);
    connectorsApi
      .resolve(ws, url)
      .then((r) => { if (alive) { setItems(r.items); setStatus('resolved'); } })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : t('connectors.error')); setStatus('error'); } });
    return () => { alive = false; };
  }, [ws, url, t]);

  const download = (indices?: number[], format?: string) => {
    const tag = indices ?? [-1]; // -1 marks the "download all" action
    const setPct = (pct: number) => setDl((d) => ({ ...d, ...Object.fromEntries(tag.map((i) => [i, pct])) }));
    const clear = () => setDl((d) => { const n = { ...d }; tag.forEach((i) => delete n[i]); return n; });
    const fail = (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('connectors.error');
      // Detect expired job error from connectors-service restart
      if (msg.toLowerCase().includes('job expired') || msg.toLowerCase().includes('job not found')) {
        setExpired(true);
        setError(msg);
      } else {
        setError(msg);
      }
      clear();
    };
    setPct(0);
    setError(null);
    setExpired(false);
    const poll = (jobId: string) =>
      connectorsApi
        .downloadJob(ws, jobId)
        .then((job) => {
          if (job.status === 'running') { setPct(job.pct); window.setTimeout(() => poll(jobId), 800); }
          else if (job.status === 'done') {
            job.items?.forEach((it) =>
              it.url.startsWith('http')
                ? triggerDownload(it.url, it.filename)
                : void downloadFile(it.url, it.filename),
            );
            clear();
          } else fail(new Error(job.error ?? t('connectors.error')));
        })
        .catch(fail);
    connectorsApi.startDownload(ws, url, indices, format).then(({ jobId }) => poll(jobId)).catch(fail);
  };

  return (
    <div className="cx-section">
      <div className="cx-sec-head">
        {showUrl && <span className="cx-sec-url" title={url}>{url}</span>}
        <span className="cx-sec-title">
          {status === 'resolving' ? (
            <><RefreshIcon className="cx-spin" /> {t('connectors.loading')}</>
          ) : status === 'error' ? (
            t('connectors.error')
          ) : (
            t('connectors.resolved', { count: items.length })
          )}
        </span>
      </div>

      {status === 'error' && (
        <div className="cx-error-section">
          <p className="cx-error">{error}</p>
          {expired && (
            <button className="cx-btn-retry" onClick={() => download()}>
              {t('connectors.retry')}
            </button>
          )}
        </div>
      )}

      {status === 'resolved' && items.length > 0 && (
        <>
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
        </>
      )}

      {status === 'resolved' && items.length === 0 && <p className="cx-empty">{t('connectors.nothingResolved')}</p>}
    </div>
  );
}

// Built-ins → Crawler. Paste one or more social links → the connectors service
// resolves each → preview the items → download. Several links resolve/download in
// parallel; the service caps how many download at once.
export function ImportMedia() {
  const { t } = useTranslation();
  const { current, loading: workspaceLoading } = useWorkspace();
  const ws = current?.id;

  const [input, setInput] = useState('');
  const [urls, setUrls] = useState<string[]>([]); // committed on Fetch; one CrawlSource each

  const fetchState = fetchButtonState({ hasWorkspace: Boolean(ws), workspaceLoading, url: input, busy: false });
  const fetchMedia = () => { if (!fetchState.disabled) setUrls(parseLinks(input)); };

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.importTitle')}</h2>
      <p className="cx-sub">{t('connectors.importSubtitle')}</p>

      <div className="cx-bar">
        <textarea
          className="cx-url cx-url-multi"
          placeholder={t('connectors.urlsPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); fetchMedia(); } }}
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

      {ws && <CrawlerCookies ws={ws} />}

      {urls.map((u) => (
        <CrawlSource key={u} ws={ws!} url={u} showUrl={urls.length > 1} />
      ))}
    </div>
  );
}
