import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, MediaQuality } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { downloadFile } from '../lib/api';
import { RefreshIcon } from '../layout/icons';
import { CrawlerCookies } from '../components/CrawlerCookies';
import './connectors.css';
import './importmedia.css';

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

// Recent import entry tracked after resolution
interface RecentEntry {
  url: string;
  itemCount: number;
  status: 'done' | 'error';
  addedAt: Date;
}

// SVG download arrow (inline) — matches the mockup's arrow-down-to-tray shape
function DownloadArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.4v7M5 6.6 8 9.6l3-3M2.8 10.4v1.8a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-1.8" />
    </svg>
  );
}

// Status pill — dot + label, color from CSS classes
function StatusPill({ status, label }: { status: 'resolving' | 'done' | 'error'; label: string }) {
  return (
    <span className={`im-pill im-pill--${status}`}>
      <span className="im-pill-dot" />
      {label}
    </span>
  );
}

// One resolved link: resolves on mount, previews its items, downloads them. Each
// instance is independent so several links run in parallel (the connectors service
// caps how many actually download at once).
// Now renders as a queue-card row (mockup layout).
function CrawlSource({
  ws,
  url,
  showUrl,
  onResolved,
  onRemove,
}: {
  ws: string;
  url: string;
  showUrl: boolean;
  onResolved?: (itemCount: number) => void;
  onRemove?: () => void;
}) {
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
      .then((r) => {
        if (alive) {
          setItems(r.items);
          setStatus('resolved');
          onResolved?.(r.items.length);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : t('connectors.error'));
          setStatus('error');
        }
      });
    return () => { alive = false; };
  }, [ws, url, t, onResolved]);

  const download = (indices?: number[], format?: string) => {
    const tag = indices ?? [-1]; // -1 marks the "download all" action
    const setPct = (pct: number) => setDl((d) => ({ ...d, ...Object.fromEntries(tag.map((i) => [i, pct])) }));
    const clear = () => setDl((d) => { const n = { ...d }; tag.forEach((i) => delete n[i]); return n; });
    const fail = (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('connectors.error');
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

  const isDownloadingAll = dl[-1] !== undefined;
  const anyBusy = Object.keys(dl).length > 0;

  // The overall download progress for the "Download all" bar
  const allPct = dl[-1] ?? 0;

  // Pill status
  const pillStatus: 'resolving' | 'done' | 'error' =
    status === 'resolving' ? 'resolving' : status === 'error' ? 'error' : 'done';
  const pillLabel =
    status === 'resolving'
      ? t('connectors.loading')
      : status === 'error'
        ? t('connectors.error')
        : t('connectors.resolved', { count: items.length });

  return (
    <div className="im-queue-card">
      {/* Card header row: URL / status pill / remove */}
      <div className="im-queue-card-head">
        <div className="im-queue-card-thumb">
          {TYPE_GLYPH[items[0]?.type ?? 'video']}
        </div>
        <div className="im-queue-card-info">
          {showUrl && (
            <div className="im-queue-card-url" title={url}>{url}</div>
          )}
          <div className="im-queue-card-meta">
            {status === 'resolving' && (
              <span className="im-queue-card-resolving">
                <RefreshIcon className="cx-spin" />
                {t('connectors.loading')}
              </span>
            )}
            {status !== 'resolving' && (
              <StatusPill status={pillStatus} label={pillLabel} />
            )}
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            className="im-queue-card-remove"
            onClick={onRemove}
            title={t('connectors.remove')}
            aria-label={t('connectors.remove')}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Error banner + retry */}
      {status === 'error' && (
        <div className="im-queue-card-body">
          <p className="cx-error">{error}</p>
          {expired && (
            <button type="button" className="cx-btn-retry im-btn-retry" onClick={() => download()}>
              {t('connectors.retry')}
            </button>
          )}
        </div>
      )}

      {/* Media tiles + download footer */}
      {status === 'resolved' && items.length > 0 && (
        <>
          {/* Quality picker + file grid */}
          <div className="im-queue-card-body">
            <div className="cx-mgrid">
              {items.map((it) => {
                const pct = dl[it.index] ?? dl[-1];
                const tileBusy = pct !== undefined;
                const chosen = pick[it.index] ?? defaultQualityFormat(it.qualities);
                return (
                  <div className="cx-tile" key={it.index}>
                    <span className="cx-tbadge">{it.type.toUpperCase()}</span>
                    <div className="cx-mthumb">
                      {it.thumbUrl ? <img src={it.thumbUrl} alt="" /> : TYPE_GLYPH[it.type]}
                    </div>
                    <div className="cx-tfoot">
                      <span className="cx-tname">{it.filename ?? `item-${it.index}`}</span>
                      <div className="cx-tactions">
                        {tileBusy ? (
                          <>
                            <progress
                              className="cx-prog"
                              max={100}
                              value={pct}
                              aria-label={t('connectors.downloading')}
                            />
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
                            <button
                              type="button"
                              className="cx-tdl"
                              title={t('connectors.download')}
                              onClick={() => download([it.index], chosen)}
                            >
                              ↓
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download all footer */}
          <div className="im-queue-card-foot">
            <span className="cx-gate">⚠️ {t('connectors.tosNote')}</span>
            {isDownloadingAll ? (
              <div className="im-dl-progress">
                <div className="im-dl-bar-track">
                  <div className="im-dl-bar-fill" style={{ transform: `scaleX(${allPct / 100})` }} />
                </div>
                <span className="im-dl-pct">{Math.round(allPct)}%</span>
              </div>
            ) : (
              <button
                type="button"
                className="im-btn-dl-all cx-btn-primary"
                disabled={anyBusy}
                onClick={() => download()}
              >
                <DownloadArrowIcon />
                {t('connectors.downloadAll')}
              </button>
            )}
          </div>
        </>
      )}

      {status === 'resolved' && items.length === 0 && (
        <div className="im-queue-card-body">
          <p className="cx-empty">{t('connectors.nothingResolved')}</p>
        </div>
      )}
    </div>
  );
}

// Recent imports row (minimal — shows resolved queue entries that finished)
function RecentImportRow({ entry }: { entry: RecentEntry }) {
  const { t } = useTranslation();
  const ageMs = Date.now() - entry.addedAt.getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const ageLabel = ageMin < 1 ? t('connectors.recentJustNow') : t('connectors.recentMinutesAgo', { n: ageMin });
  return (
    <div className="im-recent-row">
      <div className="im-recent-thumb">
        {TYPE_GLYPH.video}
      </div>
      <div className="im-recent-info">
        <div className="im-recent-url" title={entry.url}>{entry.url}</div>
        <div className="im-recent-meta">
          {entry.itemCount > 0
            ? t('connectors.resolved', { count: entry.itemCount })
            : t('connectors.nothingResolved')}
          {' · '}
          {ageLabel}
        </div>
      </div>
      <span className={`im-pill im-pill--${entry.status === 'done' ? 'done' : 'error'}`}>
        <span className="im-pill-dot" />
        {entry.status === 'done' ? t('connectors.recentStatusReady') : t('connectors.error')}
      </span>
    </div>
  );
}

// Built-ins → Crawler. Paste one or more social links → the connectors service
// resolves each → preview the items → download. Several links resolve/download in
// parallel; the service caps how many actually download at once.
export function ImportMedia() {
  const { t } = useTranslation();
  const { current, loading: workspaceLoading } = useWorkspace();
  const ws = current?.id;

  const [input, setInput] = useState('');
  const [urls, setUrls] = useState<string[]>([]); // committed on Fetch; one CrawlSource each
  const [recent, setRecent] = useState<RecentEntry[]>([]); // resolved entries for history
  const [recentTab, setRecentTab] = useState<'all' | 'video' | 'image'>('all');

  const fetchState = fetchButtonState({ hasWorkspace: Boolean(ws), workspaceLoading, url: input, busy: false });
  const fetchMedia = () => {
    if (!fetchState.disabled) {
      const links = parseLinks(input);
      setUrls(links);
    }
  };

  const handleResolved = (url: string, itemCount: number) => {
    setRecent((prev) => {
      // Avoid duplicates: replace if same url already in list
      const without = prev.filter((r) => r.url !== url);
      return [{ url, itemCount, status: 'done', addedAt: new Date() }, ...without];
    });
  };

  const handleRemove = (url: string) => {
    setUrls((prev) => prev.filter((u) => u !== url));
  };

  // Recent tab filter (no backend history — filter client-side by type stub)
  // In a real impl, entries would carry a type; for now show all when video/image tabs chosen
  const filteredRecent = recent; // tab filtering would go here when entries carry type

  return (
    <div className="im-page">
      {/* Page title */}
      <div className="im-page-title-block">
        <h1 className="im-page-h1">{t('connectors.importTitle')}</h1>
        <p className="im-page-sub">{t('connectors.importSubtitle')}</p>
      </div>

      {/* Import composer card */}
      <div className="im-composer-card">
        <div className="im-composer-card-body">
          <textarea
            className="im-textarea"
            placeholder={t('connectors.urlsPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                fetchMedia();
              }
            }}
          />
          <div className="im-composer-footer-row">
            <div className="im-platforms-row">
              <span className="im-platforms-label">{t('connectors.worksWithLabel')}</span>
              <div className="im-platform-chips">
                {['TikTok', 'Instagram', 'YouTube', 'X', 'Facebook'].map((p) => (
                  <span key={p} className="im-platform-chip">{p}</span>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="im-fetch-btn cx-btn-primary"
              disabled={fetchState.disabled}
              aria-busy={fetchState.spin}
              onClick={fetchMedia}
            >
              {fetchState.spin && <RefreshIcon className="cx-spin" />}
              <DownloadArrowIcon />
              {t(`connectors.${fetchState.labelKey}`)}
            </button>
          </div>
        </div>

        {/* Cookies footer strip */}
        <div className="im-composer-card-cookies">
          {ws && <CrawlerCookies ws={ws} />}
          {fetchState.statusKey && (
            <p className="cx-status im-status-inline">{t(`connectors.${fetchState.statusKey}`)}</p>
          )}
        </div>
      </div>

      {/* Download queue */}
      {urls.length > 0 && (
        <section className="im-section">
          <div className="im-section-head">
            <div className="im-section-head-left">
              <h2 className="im-section-h2">{t('connectors.queueTitle')}</h2>
              <span className="im-count-badge">{urls.length}</span>
            </div>
            <button
              type="button"
              className="im-btn-clear"
              onClick={() => setUrls([])}
            >
              {t('connectors.queueClear')}
            </button>
          </div>
          <div className="im-queue-list">
            {urls.map((u) => (
              <CrawlSource
                key={u}
                ws={ws!}
                url={u}
                showUrl={urls.length > 1}
                onResolved={(count) => handleResolved(u, count)}
                onRemove={() => handleRemove(u)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent imports */}
      <section className="im-section">
        <div className="im-section-head">
          <div className="im-section-head-left">
            <h2 className="im-section-h2">{t('connectors.recentTitle')}</h2>
            {recent.length > 0 && <span className="im-count-badge">{recent.length}</span>}
          </div>
          {/* Tab segment — All / Video / Images */}
          <div className="im-tab-seg">
            {(['all', 'video', 'image'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`im-tab-btn${recentTab === tab ? ' im-tab-btn--on' : ''}`}
                onClick={() => setRecentTab(tab)}
              >
                {t(`connectors.recentTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {filteredRecent.length === 0 ? (
          <div className="im-recent-empty">
            <p className="cx-empty">{t('connectors.recentEmpty')}</p>
          </div>
        ) : (
          <div className="im-recent-table">
            <div className="im-recent-table-head">
              <span>{t('connectors.recentColSource')}</span>
              <span>{t('connectors.recentColItems')}</span>
              <span>{t('connectors.recentColStatus')}</span>
            </div>
            {filteredRecent.map((entry) => (
              <RecentImportRow key={entry.url} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
