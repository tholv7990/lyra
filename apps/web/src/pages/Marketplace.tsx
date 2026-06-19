import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Provider,
  defaultModel,
  labelColor,
  type MarketplaceFacets,
  type MarketplacePrompt,
  type RankedMarketplacePrompt,
} from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { marketplaceApi } from '../lib/marketplace';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { MarketplaceDetails } from '../components/MarketplaceDetails';
import {
  ChatsIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  MarketplaceIcon,
  PlusIcon,
} from '../layout/icons';
import './marketplace.css';

const PAGE_SIZE = 30;

// Catalog types are a small fixed vocabulary (mirrors the marketplace schema).
const TYPE_VALUES = ['text', 'structured'] as const;
// Tags can be a long list — collapse them behind a <details> like Prompts does.
const TAG_COLLAPSE_THRESHOLD = 8;

// Toggle a value in a multi-select filter list (add if absent, remove if present).
// Mirrors the Prompts page helper.
function toggleFilterValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

// Tracks the adopt state of a single row so the action can flip to "Added".
type AdoptState = 'idle' | 'busy' | 'done';

export function Marketplace() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const ws = current?.id;

  // Browse state
  const [items, setItems] = useState<MarketplacePrompt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Browse filters (Linear-style: search always visible, type/category/tag
  // added via the + Filter popover). Multi-select each.
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [facets, setFacets] = useState<MarketplaceFacets>({ categories: [], tags: [] });
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // AI-filter state. `ranked` non-null = we're in AI-results mode (browse hidden).
  const [aiQuery, setAiQuery] = useState('');
  const [ranked, setRanked] = useState<RankedMarketplacePrompt[] | null>(null);
  const [rankedFor, setRankedFor] = useState('');
  const [ranking, setRanking] = useState(false);

  // Per-card adopt state, transient copy confirmation, and a toast.
  const [adopt, setAdopt] = useState<Record<string, AdoptState>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // The catalog prompt shown in the detail modal (null = closed).
  const [detail, setDetail] = useState<MarketplacePrompt | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = types.length + categories.length + tags.length;
  const hasFilters = filterCount > 0 || !!q.trim();

  useEffect(() => setPage(1), [q, types, categories, tags]);

  // Load the browse catalog (skipped while AI results are showing).
  useEffect(() => {
    if (!ws || ranked) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      marketplaceApi
        .list(ws, { page, limit: PAGE_SIZE, q, types, categories, tags })
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
  }, [ws, page, q, types, categories, tags, ranked, t]);

  // Load filter vocabularies once per workspace (categories + tags across the
  // whole catalog) so the popover options stay stable as other filters narrow.
  useEffect(() => {
    if (!ws) return;
    let cancelled = false;
    marketplaceApi
      .facets(ws)
      .then((res) => !cancelled && setFacets(res))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ws]);

  // Close the filter popover on outside click or Escape (a11y, mirrors Prompts).
  useEffect(() => {
    if (!filterMenu) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterMenu]);

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

  // Copy the raw prompt to the clipboard — the grab-and-go action this catalog
  // is built around. Flips the icon to a check for a beat.
  function copyPrompt(p: MarketplacePrompt) {
    void navigator.clipboard?.writeText(p.content);
    setCopied(p.id);
    setToast(t('marketplace.copiedToast', { title: p.title }));
    window.setTimeout(() => setToast(null), 2400);
    window.setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1500);
  }

  // Try the prompt immediately in a fresh chat (composer pre-seeded). Not a
  // library prompt yet, so no originPromptId — just a draft with a back-link.
  function openInChat(p: MarketplacePrompt) {
    navigate('/chats', {
      state: {
        seed: p.content,
        provider: Provider.Anthropic,
        model: defaultModel(Provider.Anthropic),
        from: { label: t('marketplace.heading'), to: '/marketplace', record: p.title },
      },
    });
  }

  const showRanked = ranked !== null;
  const rankedEmpty = showRanked && ranked!.length === 0;

  const card = (p: MarketplacePrompt, rank?: RankedMarketplacePrompt) => (
    <Card
      key={p.id}
      prompt={p}
      rank={rank}
      state={adopt[p.id] ?? 'idle'}
      copied={copied === p.id}
      onAdopt={() => void adoptPrompt(p)}
      onView={() => setDetail(p)}
      onCopy={() => copyPrompt(p)}
      onOpenInChat={() => openInChat(p)}
      t={t}
    />
  );

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
          <div className="lin-filter" ref={filterRef}>
            <button
              type="button"
              className={`lin-filter-btn ${filterCount > 0 || filterMenu ? 'active' : ''}`}
              aria-expanded={filterMenu}
              aria-haspopup="true"
              onClick={() => setFilterMenu((s) => !s)}
            >
              + {t('marketplace.filter')}
              {filterCount > 0 && <> <span className="lin-filter-count">{filterCount}</span></>}
            </button>
            {filterMenu && (
              <div className="lin-menu" role="menu">
                <div className="lin-menu-actions">
                  <button
                    type="button"
                    className="lin-menu-clear"
                    disabled={filterCount === 0}
                    onClick={() => {
                      setTypes([]);
                      setCategories([]);
                      setTags([]);
                    }}
                  >
                    {t('marketplace.clear')}
                  </button>
                </div>

                <div className="lin-menu-label">{t('marketplace.filterType')}</div>
                {TYPE_VALUES.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    className="lin-menu-item"
                    onClick={() => setTypes((list) => toggleFilterValue(list, ty))}
                  >
                    {ty === 'structured'
                      ? t('marketplace.typeStructured')
                      : t('marketplace.typeText')}
                    {types.includes(ty) && <span className="lin-menu-check">✓</span>}
                  </button>
                ))}

                {facets.categories.length > 0 && (
                  <>
                    <div className="lin-menu-label">{t('marketplace.filterCategory')}</div>
                    {facets.categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="lin-menu-item"
                        onClick={() => setCategories((list) => toggleFilterValue(list, c))}
                      >
                        <span className="dot" style={{ background: labelColor(c, []) }} />
                        {c}
                        {categories.includes(c) && <span className="lin-menu-check">✓</span>}
                      </button>
                    ))}
                  </>
                )}

                {facets.tags.length > 0 &&
                  (facets.tags.length > TAG_COLLAPSE_THRESHOLD ? (
                    <details className="lin-menu-section">
                      <summary className="lin-menu-summary">
                        <span>{t('marketplace.filterTags')}</span>
                        {tags.length > 0 && (
                          <span className="lin-menu-summary-count">{tags.length}</span>
                        )}
                      </summary>
                      {facets.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="lin-menu-item"
                          onClick={() => setTags((list) => toggleFilterValue(list, tag))}
                        >
                          <span className="dot" style={{ background: labelColor(tag, []) }} />
                          {tag}
                          {tags.includes(tag) && <span className="lin-menu-check">✓</span>}
                        </button>
                      ))}
                    </details>
                  ) : (
                    <>
                      <div className="lin-menu-label">{t('marketplace.filterTags')}</div>
                      {facets.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="lin-menu-item"
                          onClick={() => setTags((list) => toggleFilterValue(list, tag))}
                        >
                          <span className="dot" style={{ background: labelColor(tag, []) }} />
                          {tag}
                          {tags.includes(tag) && <span className="lin-menu-check">✓</span>}
                        </button>
                      ))}
                    </>
                  ))}
              </div>
            )}
          </div>
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

      {/* Body: loading / empty / catalog cards */}
      {!showRanked && loading ? (
        <p className="empty">{t('marketplace.loading')}</p>
      ) : showRanked ? (
        rankedEmpty ? (
          <p className="empty">{t('marketplace.noRanked')}</p>
        ) : (
          <div className="mkt-grid">{ranked!.map((r) => card(r.prompt, r))}</div>
        )
      ) : items.length === 0 ? (
        hasFilters ? (
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
          <div className="mkt-grid">{items.map((p) => card(p))}</div>
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

      {detail && (
        <MarketplaceDetails
          prompt={detail}
          state={adopt[detail.id] ?? 'idle'}
          onAdopt={() => void adoptPrompt(detail)}
          onOpenInChat={() => openInChat(detail)}
          onClose={() => setDetail(null)}
        />
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
  copied: boolean;
  onAdopt: () => void;
  onView: () => void;
  onCopy: () => void;
  onOpenInChat: () => void;
  t: TFn;
}

// One catalog entry as a browsable card — prompts.chat-style gallery in the
// app's own tokens. Title/body open the detail modal; copy / open-in-chat /
// adopt are the grab-and-go actions.
function Card({ prompt, rank, state, copied, onAdopt, onView, onCopy, onOpenInChat, t }: CardProps) {
  const contributor = prompt.contributor?.trim();
  const done = state === 'done';
  return (
    <article className="mkt-card">
      <div className="mkt-card-head">
        <button type="button" className="mkt-card-title" onClick={onView} title={t('marketplace.view')}>
          <span className="nm">{prompt.title}</span>
        </button>
        <span className="mkt-card-badges">
          {prompt.category && <span className="badge mkt-cat">{prompt.category}</span>}
          <span className="badge mkt-type">
            {prompt.type === 'structured' ? t('marketplace.typeStructured') : t('marketplace.typeText')}
          </span>
        </span>
      </div>

      {rank && (
        <div className="mkt-rank">
          <span className="mkt-rank-score">{t('marketplace.relevance', { score: Math.round(rank.score) })}</span>
          {rank.reason && <span className="mkt-rank-reason">{rank.reason}</span>}
        </div>
      )}

      {prompt.description && <p className="mkt-card-desc" onClick={onView}>{prompt.description}</p>}

      {/* Prompt preview in a monospace code-block (prompts.chat's signature look);
          a plain block clamps reliably, title + eye are the accessible openers. */}
      <p className="mkt-card-code" onClick={onView} title={t('marketplace.view')}>
        {prompt.content}
      </p>

      {prompt.tags.length > 0 && (
        <div className="mkt-card-tags">
          {prompt.tags.map((tag) => {
            const c = labelColor(tag, []);
            return (
              <span
                key={tag}
                className="mkt-tag"
                style={{ background: `${c}1f`, borderColor: `${c}3a` }}
              >
                <span className="mkt-tag-dot" style={{ background: c }} />
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {prompt.variables.length > 0 && (
        <div className="mkt-card-vars">
          {prompt.variables.slice(0, 5).map((v) => (
            <span key={v} className="tag-chip ro mkt-var">{`{${v}}`}</span>
          ))}
          {prompt.variables.length > 5 && <span className="more">+{prompt.variables.length - 5}</span>}
        </div>
      )}

      <div className="mkt-card-foot">
        <span className="mkt-card-by" title={t('marketplace.openSource', { source: prompt.source })}>
          {contributor ? t('marketplace.by', { name: contributor }) : t('marketplace.byUnknown')}
        </span>
        <div className="mkt-card-actions">
          <IconButton
            size="sm"
            icon={copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
            label={copied ? t('marketplace.copied') : t('marketplace.copy')}
            onClick={onCopy}
          />
          <IconButton
            size="sm"
            icon={<ChatsIcon width={15} height={15} />}
            label={t('marketplace.openInChat')}
            onClick={onOpenInChat}
          />
          <IconButton
            size="sm"
            icon={<EyeIcon width={15} height={15} />}
            label={t('marketplace.view')}
            onClick={onView}
          />
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
        </div>
      </div>
    </article>
  );
}
