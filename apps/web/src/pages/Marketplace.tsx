import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  MarketplacePrompt,
  RankedMarketplacePrompt,
} from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { marketplaceApi } from '../lib/marketplace';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { MarketplaceIcon, PlusIcon, RefreshIcon } from '../layout/icons';
import './marketplace.css';

const PAGE_SIZE = 30;

// Tracks the adopt state of a single card so the button can flip to "Added ✓".
type AdoptState = 'idle' | 'busy' | 'done';

export function Marketplace() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  // Browse state
  const [items, setItems] = useState<MarketplacePrompt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [forDevs, setForDevs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI-filter state. `ranked` non-null = we're in AI-results mode (browse hidden).
  const [aiQuery, setAiQuery] = useState('');
  const [ranked, setRanked] = useState<RankedMarketplacePrompt[] | null>(null);
  const [rankedFor, setRankedFor] = useState('');
  const [ranking, setRanking] = useState(false);

  // Per-card adopt state + a transient confirmation toast.
  const [adopt, setAdopt] = useState<Record<string, AdoptState>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Admin refresh (sync) state.
  const [syncing, setSyncing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => setPage(1), [q, forDevs]);

  // Load the browse catalog (skipped while AI results are showing).
  useEffect(() => {
    if (!ws || ranked) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      marketplaceApi
        .list(ws, { page, limit: PAGE_SIZE, q, forDevs: forDevs ? true : undefined })
        .then((res) => {
          if (cancelled) return;
          setItems(res.items);
          setTotal(res.total);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setItems([]);
          setError(err instanceof Error ? err.message : t('marketplace.error'));
        })
        .finally(() => !cancelled && setLoading(false));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ws, page, q, forDevs, ranked, t]);

  const runRank = useCallback(async () => {
    const query = aiQuery.trim();
    if (!ws || !query) return;
    setRanking(true);
    setError(null);
    try {
      const res = await marketplaceApi.rank(ws, query, PAGE_SIZE);
      setRanked(res);
      setRankedFor(query);
    } catch (err) {
      // The api returns a friendly 400 when no Anthropic key is configured —
      // surface that message verbatim.
      setError(err instanceof Error ? err.message : t('marketplace.errRank'));
    } finally {
      setRanking(false);
    }
  }, [ws, aiQuery, t]);

  function clearRank() {
    setRanked(null);
    setRankedFor('');
    setError(null);
  }

  async function adoptPrompt(p: MarketplacePrompt) {
    if (!ws || adopt[p.id] === 'busy' || adopt[p.id] === 'done') return;
    setAdopt((s) => ({ ...s, [p.id]: 'busy' }));
    try {
      await marketplaceApi.adopt(ws, p.id);
      setAdopt((s) => ({ ...s, [p.id]: 'done' }));
      setToast(t('marketplace.adoptedToast', { title: p.title }));
      window.setTimeout(() => setToast(null), 3200);
    } catch (err) {
      setAdopt((s) => ({ ...s, [p.id]: 'idle' }));
      // Friendly 400 (e.g. missing Anthropic key) bubbles up here too.
      setError(err instanceof Error ? err.message : t('marketplace.errAdopt'));
    }
  }

  async function refreshCatalog() {
    if (!ws || syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const { imported } = await marketplaceApi.sync(ws);
      setToast(t('marketplace.refreshed', { count: imported }));
      window.setTimeout(() => setToast(null), 3200);
      // Re-pull the first page so freshly imported prompts appear.
      clearRank();
      setPage(1);
      const res = await marketplaceApi.list(ws, { page: 1, limit: PAGE_SIZE, q, forDevs: forDevs ? true : undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketplace.error'));
    } finally {
      setSyncing(false);
    }
  }

  const showRanked = ranked !== null;
  const rankedEmpty = showRanked && ranked!.length === 0;

  return (
    <div className="mkt">
      <h1 className="sr-only">{t('marketplace.heading')}</h1>

      {/* AI filter — the prominent hero control */}
      <form
        className="mkt-ai"
        onSubmit={(e) => {
          e.preventDefault();
          void runRank();
        }}
      >
        <input
          className="mkt-ai-input"
          placeholder={t('marketplace.aiPlaceholder')}
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          aria-label={t('marketplace.aiPlaceholder')}
        />
        <button className="btn-primary" type="submit" disabled={ranking || !aiQuery.trim()}>
          {ranking ? t('marketplace.aiRunning') : t('marketplace.aiRun')}
        </button>
      </form>
      <p className="mkt-sub">{t('marketplace.subtitle')}</p>

      {/* Browse toolbar — hidden while AI results are showing */}
      {!showRanked && (
        <div className="lin-toolbar mkt-toolbar">
          <input
            className="lin-search"
            placeholder={t('marketplace.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('marketplace.searchPlaceholder')}
          />
          <button
            type="button"
            className={`mkt-toggle ${forDevs ? 'active' : ''}`}
            aria-pressed={forDevs}
            title={t('marketplace.forDevsHint')}
            onClick={() => setForDevs((v) => !v)}
          >
            {t('marketplace.forDevs')}
          </button>
          <IconButton
            className="mkt-refresh"
            size="sm"
            icon={<RefreshIcon width={15} height={15} />}
            label={syncing ? t('marketplace.refreshing') : t('marketplace.refresh')}
            disabled={syncing}
            onClick={() => void refreshCatalog()}
          />
        </div>
      )}

      {/* AI results header */}
      {showRanked && (
        <div className="mkt-ai-head">
          <div className="mkt-ai-head-text">
            <span className="mkt-ai-title">{t('marketplace.aiResultsFor', { query: rankedFor })}</span>
            <span className="mkt-ai-hint">{t('marketplace.aiHint')}</span>
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={clearRank}>
            {t('marketplace.browseAll')}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Body: loading / empty / grid */}
      {!showRanked && loading ? (
        <CardSkeletons />
      ) : showRanked ? (
        rankedEmpty ? (
          <p className="empty">{t('marketplace.noRanked')}</p>
        ) : (
          <div className="mkt-grid">
            {ranked!.map((r) => (
              <Card
                key={r.prompt.id}
                prompt={r.prompt}
                rank={r}
                state={adopt[r.prompt.id] ?? 'idle'}
                onAdopt={() => void adoptPrompt(r.prompt)}
                t={t}
              />
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        q.trim() || forDevs ? (
          <p className="empty">{t('marketplace.noMatch')}</p>
        ) : (
          <EmptyState
            icon={<MarketplaceIcon width={26} height={26} />}
            title={t('marketplace.emptyTitle')}
            body={t('marketplace.emptyBody')}
          />
        )
      ) : (
        <>
          <div className="mkt-grid">
            {items.map((p) => (
              <Card
                key={p.id}
                prompt={p}
                state={adopt[p.id] ?? 'idle'}
                onAdopt={() => void adoptPrompt(p)}
                t={t}
              />
            ))}
          </div>
          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
              ← {t('marketplace.prev')}
            </button>
            <span className="pager-info">{t('marketplace.pagerInfo', { page, totalPages, total })}</span>
            <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((n) => n + 1)}>
              {t('marketplace.next')} →
            </button>
          </div>
        </>
      )}

      {toast && (
        <div className="mkt-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

interface CardProps {
  prompt: MarketplacePrompt;
  rank?: RankedMarketplacePrompt;
  state: AdoptState;
  onAdopt: () => void;
  t: TFn;
}

function Card({ prompt, rank, state, onAdopt, t }: CardProps) {
  const contributor = prompt.contributor?.trim();
  const done = state === 'done';
  return (
    <article className="mkt-card">
      <div className="mkt-card-head">
        <h3 className="mkt-card-title">{prompt.title}</h3>
        {prompt.forDevs && <span className="mkt-dev">{t('marketplace.devBadge')}</span>}
      </div>

      {rank && (
        <div className="mkt-rank">
          <span className="mkt-rank-score">{t('marketplace.relevance', { score: Math.round(rank.score) })}</span>
          {rank.reason && <span className="mkt-rank-reason">{rank.reason}</span>}
        </div>
      )}

      <p className="mkt-preview">{prompt.content}</p>

      {prompt.variables.length > 0 && (
        <div className="mkt-vars" aria-label={t('marketplace.variables')}>
          {prompt.variables.slice(0, 6).map((v) => (
            <span key={v} className="tag-chip ro mkt-var">{`{${v}}`}</span>
          ))}
          {prompt.variables.length > 6 && (
            <span className="more">+{prompt.variables.length - 6}</span>
          )}
        </div>
      )}

      <div className="mkt-card-foot">
        <span className="mkt-by" title={t('marketplace.openSource', { source: prompt.source })}>
          {contributor
            ? t('marketplace.by', { name: contributor })
            : t('marketplace.byUnknown')}
        </span>
        {done ? (
          <button className="btn-ghost btn-sm mkt-added" type="button" disabled>
            {t('marketplace.added')}
          </button>
        ) : (
          <IconButton
            variant="primary"
            size="sm"
            icon={<PlusIcon width={14} height={14} />}
            label={state === 'busy' ? t('marketplace.adding') : t('marketplace.add')}
            disabled={state === 'busy'}
            onClick={onAdopt}
          />
        )}
      </div>
    </article>
  );
}

// Lightweight loading placeholders — six token-styled card silhouettes.
function CardSkeletons() {
  return (
    <div className="mkt-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="mkt-card mkt-skel" key={i}>
          <div className="mkt-skel-line w60" />
          <div className="mkt-skel-line w90" />
          <div className="mkt-skel-line w80" />
          <div className="mkt-skel-line w40" />
        </div>
      ))}
    </div>
  );
}
