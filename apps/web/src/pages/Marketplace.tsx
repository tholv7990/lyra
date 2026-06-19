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
import { MarketplaceIcon, PlusIcon } from '../layout/icons';
import './marketplace.css';

const PAGE_SIZE = 30;

// Tracks the adopt state of a single row so the action can flip to "Added".
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

  // Per-row adopt state + a transient confirmation toast.
  const [adopt, setAdopt] = useState<Record<string, AdoptState>>({});
  const [toast, setToast] = useState<string | null>(null);

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

  const showRanked = ranked !== null;
  const rankedEmpty = showRanked && ranked!.length === 0;

  return (
    <div>
      <h1 className="sr-only">{t('marketplace.heading')}</h1>

      {/* AI filter — the prominent hero control, in the app's input/button vocabulary */}
      <form
        className="mkt-ai"
        onSubmit={(e) => {
          e.preventDefault();
          void runRank();
        }}
      >
        <input
          className="lin-search"
          placeholder={t('marketplace.aiPlaceholder')}
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          aria-label={t('marketplace.aiPlaceholder')}
        />
        <button className="btn-primary mkt-ai-go" type="submit" disabled={ranking || !aiQuery.trim()}>
          {ranking ? t('marketplace.aiRunning') : t('marketplace.aiRun')}
        </button>
      </form>
      <p className="mkt-sub">{t('marketplace.subtitle')}</p>

      {/* Browse toolbar — hidden while AI results are showing */}
      {!showRanked && (
        <div className="lin-toolbar">
          <input
            className="lin-search"
            placeholder={t('marketplace.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('marketplace.searchPlaceholder')}
          />
          <button
            type="button"
            className={`lin-filter-btn ${forDevs ? 'active' : ''}`}
            aria-pressed={forDevs}
            title={t('marketplace.forDevsHint')}
            onClick={() => setForDevs((v) => !v)}
          >
            {t('marketplace.forDevs')}
          </button>
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

      {/* Body: loading / empty / catalog rows */}
      {!showRanked && loading ? (
        <p className="empty">{t('marketplace.loading')}</p>
      ) : showRanked ? (
        rankedEmpty ? (
          <p className="empty">{t('marketplace.noRanked')}</p>
        ) : (
          <div className="ptable t-marketplace">
            {ranked!.map((r) => (
              <Row
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
          <div className="ptable t-marketplace">
            {items.map((p) => (
              <Row
                key={p.id}
                prompt={p}
                state={adopt[p.id] ?? 'idle'}
                onAdopt={() => void adoptPrompt(p)}
                t={t}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="pager">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                ← {t('marketplace.prev')}
              </button>
              <span className="pager-info">{t('marketplace.pagerInfo', { page, totalPages, total })}</span>
              <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((n) => n + 1)}>
                {t('marketplace.next')} →
              </button>
            </div>
          )}
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

interface RowProps {
  prompt: MarketplacePrompt;
  rank?: RankedMarketplacePrompt;
  state: AdoptState;
  onAdopt: () => void;
  t: TFn;
}

// One catalog entry — shares the app's .prow list-row treatment (Prompts/Pipelines).
function Row({ prompt, rank, state, onAdopt, t }: RowProps) {
  const contributor = prompt.contributor?.trim();
  const done = state === 'done';
  return (
    <div className="prow">
      <div className="prow-namecell">
        <span className="prow-name">
          <span className="nm">{prompt.title}</span>
        </span>
        {rank && (
          <span className="mkt-rank">
            <span className="mkt-rank-score">{t('marketplace.relevance', { score: Math.round(rank.score) })}</span>
            {rank.reason && <span className="mkt-rank-reason">{rank.reason}</span>}
          </span>
        )}
        <span className="prow-sniprow">
          <span className="snip">{prompt.content}</span>
        </span>
      </div>

      <span className="prow-tags">
        {prompt.variables.slice(0, 4).map((v) => (
          <span key={v} className="tag-chip ro mkt-var">{`{${v}}`}</span>
        ))}
        {prompt.variables.length > 4 && (
          <span className="more">+{prompt.variables.length - 4}</span>
        )}
      </span>

      <span className="prow-status">
        {prompt.forDevs && <span className="badge mkt-dev">{t('marketplace.devBadge')}</span>}
      </span>

      <span className="prow-facts">
        <span className="prow-date" title={t('marketplace.openSource', { source: prompt.source })}>
          {contributor
            ? t('marketplace.by', { name: contributor })
            : t('marketplace.byUnknown')}
        </span>
      </span>

      <span className="prow-actions">
        {done ? (
          <span className="mkt-added">{t('marketplace.added')}</span>
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
      </span>
    </div>
  );
}
