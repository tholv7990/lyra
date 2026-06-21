import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Provider,
  defaultModel,
  labelColor,
  type MarketplaceFacets,
  type MarketplacePrompt,
  type MarketplaceSort,
  type RankedMarketplacePrompt,
} from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { useAuth } from '../auth/useAuth';
import { Avatar } from '../components/Avatar';
import { TagChip } from '../components/TagChip';
import { marketplaceApi } from '../lib/marketplace';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useEscapeKey } from '../lib/useEscapeKey';
import { toggleInList } from '../lib/array';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { Checkbox } from '../components/Checkbox';
import { MarketplaceDetails } from '../components/MarketplaceDetails';
import { Pager } from '../components/Pager';
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  FilterIcon,
  MarketplaceIcon,
  PlusIcon,
  SparkleIcon,
} from '../layout/icons';
import './marketplace.css';

const PAGE_SIZE = 30;
const TYPE_VALUES = ['text', 'structured'] as const;

// Tracks the adopt state of a single row so the action can flip to "Added".
type AdoptState = 'idle' | 'busy' | 'done';

// Inline search glyph (no shared SearchIcon yet) — matches the design's search box.
function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.4 10.4 3 3" />
    </svg>
  );
}

export function Marketplace() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const ws = current?.id;
  // Unverified password signups can browse but not adopt (the api blocks it too).
  const unverified = user?.emailVerified === false;

  // Browse state
  const [items, setItems] = useState<MarketplacePrompt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters: category is a single-select pill row; Type + For-developers live in
  // the Filter popover; sort drives the result order.
  const [category, setCategory] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [forDevs, setForDevs] = useState(false);
  const [sort, setSort] = useState<MarketplaceSort>('az');
  const [facets, setFacets] = useState<MarketplaceFacets>({
    categories: [],
    tags: [],
    total: 0,
    categoryCounts: [],
  });
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // AI-rank state. `ranked` non-null = AI-results mode (pills/meta/pager hidden).
  const [ranked, setRanked] = useState<RankedMarketplacePrompt[] | null>(null);
  const [ranking, setRanking] = useState(false);

  // Per-card adopt state, transient copy confirmation, and a toast.
  const [adopt, setAdopt] = useState<Record<string, AdoptState>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [detail, setDetail] = useState<MarketplacePrompt | null>(null);
  const [confirmAdopt, setConfirmAdopt] = useState<MarketplacePrompt | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = types.length + (forDevs ? 1 : 0);
  const hasFilters = filterCount > 0 || !!category || !!q.trim();
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const showRanked = ranked !== null;

  useEffect(() => setPage(1), [q, types, category, forDevs, sort]);

  // Load the browse catalog (skipped while AI results are showing).
  useEffect(() => {
    if (!ws || ranked) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      marketplaceApi
        .list(ws, {
          page,
          limit: PAGE_SIZE,
          q,
          types,
          categories: category ? [category] : [],
          forDevs: forDevs || undefined,
          sort,
        })
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
  }, [ws, page, q, types, category, forDevs, sort, ranked, t]);

  // Load facets (categories + per-category counts + total) once per workspace.
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

  useOutsideClick(filterRef, filterMenu, () => setFilterMenu(false));
  useEscapeKey(() => setFilterMenu(false), filterMenu);

  const runRank = useCallback(async () => {
    const query = q.trim();
    if (!ws || !query) return;
    setRanking(true);
    setError(null);
    try {
      const res = await marketplaceApi.rank(ws, query, PAGE_SIZE);
      setRanked(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketplace.errRank'));
    } finally {
      setRanking(false);
    }
  }, [ws, q, t]);

  function clearRank() {
    setRanked(null);
    setError(null);
  }

  // AI rank toggles: off → rank the current query; on → back to browse.
  function toggleAi() {
    if (showRanked) clearRank();
    else void runRank();
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
      setError(err instanceof Error ? err.message : t('marketplace.errAdopt'));
    }
  }

  function copyPrompt(p: MarketplacePrompt) {
    void navigator.clipboard?.writeText(p.content);
    setCopied(p.id);
    setToast(t('marketplace.copiedToast', { title: p.title }));
    window.setTimeout(() => setToast(null), 2400);
    window.setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1500);
  }

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

  const rankedEmpty = showRanked && ranked!.length === 0;

  const card = (p: MarketplacePrompt, rank?: RankedMarketplacePrompt) => (
    <Card
      key={p.id}
      prompt={p}
      rank={rank}
      state={adopt[p.id] ?? 'idle'}
      locked={unverified}
      copied={copied === p.id}
      onAdopt={() => setConfirmAdopt(p)}
      onView={() => setDetail(p)}
      onCopy={() => copyPrompt(p)}
      t={t}
    />
  );

  // Category pills: All (catalog total) + each category with its count.
  const pills = [
    { key: '', label: t('marketplace.allCategories'), count: facets.total },
    ...facets.categoryCounts.map((c) => ({ key: c.name, label: c.name, count: c.count })),
  ];

  return (
    <div className="mkt-page">
      <header className="mkt-head">
        <h1>{t('marketplace.heading')}</h1>
        <p>{t('marketplace.subtitle')}</p>
      </header>

      {/* Toolbar — search · AI rank (toggle) · Filter. */}
      <div className="mkt-toolbar">
        <label className="mkt-search">
          <SearchGlyph />
          <input
            value={q}
            placeholder={showRanked ? t('marketplace.aiPlaceholder') : t('marketplace.searchPlaceholder')}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('marketplace.searchPlaceholder')}
          />
        </label>
        <button
          type="button"
          className={`mkt-tool-btn mkt-ai-toggle${showRanked ? ' active' : ''}`}
          onClick={toggleAi}
          disabled={!showRanked && (ranking || !q.trim())}
          title={t('marketplace.aiSearchHint')}
        >
          <SparkleIcon width={15} height={15} />
          {ranking ? t('marketplace.aiRunning') : t('marketplace.aiRank')}
        </button>
        <div className="mkt-filter" ref={filterRef}>
          <button
            type="button"
            className={`mkt-tool-btn${filterCount > 0 || filterMenu ? ' active' : ''}`}
            aria-expanded={filterMenu}
            aria-haspopup="true"
            onClick={() => setFilterMenu((s) => !s)}
          >
            <FilterIcon width={15} height={15} />
            {t('marketplace.filter')}
            {filterCount > 0 && <span className="mkt-filter-count">{filterCount}</span>}
          </button>
          {filterMenu && (
            <div className="mkt-filter-menu" role="menu">
              <div className="mkt-filter-label">{t('marketplace.filterType')}</div>
              {TYPE_VALUES.map((ty) => (
                <Checkbox
                  key={ty}
                  checked={types.includes(ty)}
                  onChange={() => setTypes((list) => toggleInList(list, ty))}
                  label={ty === 'structured' ? t('marketplace.typeStructured') : t('marketplace.typeText')}
                />
              ))}
              <div className="mkt-filter-sep" />
              <Checkbox
                checked={forDevs}
                onChange={() => setForDevs((v) => !v)}
                label={t('marketplace.filterForDevs')}
              />
              <div className="mkt-filter-foot">
                <button
                  type="button"
                  className="btn-ghost btn-inline btn-sm"
                  disabled={filterCount === 0}
                  onClick={() => {
                    setTypes([]);
                    setForDevs(false);
                  }}
                >
                  {t('marketplace.clear')}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-inline btn-sm"
                  onClick={() => setFilterMenu(false)}
                >
                  {t('marketplace.done')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI banner */}
      {showRanked && !rankedEmpty && (
        <div className="mkt-banner">
          <SparkleIcon width={16} height={16} />
          <span>
            <strong>{t('marketplace.aiBannerTitle')}</strong> {t('marketplace.aiBannerBody')}
          </span>
        </div>
      )}

      {/* Category pills (browse only) */}
      {!showRanked && pills.length > 1 && (
        <div className="mkt-pills">
          {pills.map((p) => (
            <button
              key={p.key || 'all'}
              type="button"
              className={`mkt-pill${category === p.key ? ' active' : ''}`}
              onClick={() => setCategory(p.key)}
            >
              {p.label}
              <span className="mkt-pill-count">{p.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result meta + sort (browse only) */}
      {!showRanked && !loading && total > 0 && (
        <div className="mkt-meta">
          <span className="mkt-meta-count">
            {t('marketplace.showingRange', { start: rangeStart, end: rangeEnd, total })}
          </span>
          <label className="mkt-sort">
            {t('marketplace.sortLabel')}
            <select
              className="mkt-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as MarketplaceSort)}
            >
              <option value="newest">{t('marketplace.sortNewest')}</option>
              <option value="az">{t('marketplace.sortAz')}</option>
            </select>
          </label>
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
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {detail && (
        <MarketplaceDetails
          prompt={detail}
          state={adopt[detail.id] ?? 'idle'}
          locked={unverified}
          onAdopt={() => setConfirmAdopt(detail)}
          onOpenInChat={() => openInChat(detail)}
          onViewLibrary={() => navigate('/prompts')}
          onClose={() => setDetail(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmAdopt}
        title={t('marketplace.confirmAddTitle')}
        message={t('marketplace.confirmAddBody', { title: confirmAdopt?.title ?? '' })}
        confirmLabel={t('marketplace.add')}
        onConfirm={() => {
          if (confirmAdopt) void adoptPrompt(confirmAdopt);
          setConfirmAdopt(null);
        }}
        onCancel={() => setConfirmAdopt(null)}
      />

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
  locked?: boolean;
  copied: boolean;
  onAdopt: () => void;
  onView: () => void;
  onCopy: () => void;
  t: TFn;
}

// One catalog entry — badges, title + desc, optional AI score, mono preview,
// tags/vars, then a footer of contributor + Preview / Copy / Adopt.
function Card({ prompt, rank, state, locked, copied, onAdopt, onView, onCopy, t }: CardProps) {
  const contributor = prompt.contributor?.trim();
  const done = state === 'done';
  const catColor = prompt.category ? labelColor(prompt.category, []) : undefined;
  return (
    <article className="mkt-card">
      <div className="mkt-card-badges">
        {prompt.category && (
          <span className="mkt-cat-pill">
            <span className="mkt-dot" style={{ background: catColor }} />
            {prompt.category}
          </span>
        )}
        <span className="mkt-type-pill">
          {prompt.type === 'structured' ? t('marketplace.typeStructured') : t('marketplace.typeText')}
        </span>
      </div>

      <button type="button" className="mkt-card-title" onClick={onView} title={t('marketplace.view')}>
        {prompt.title}
      </button>
      {prompt.description && (
        <p className="mkt-card-desc" onClick={onView}>
          {prompt.description}
        </p>
      )}

      {rank && (
        <div className="mkt-score">
          <span className="mkt-score-num">{Math.round(rank.score)}</span>
          {rank.reason && (
            <span className="mkt-score-reason">
              <strong>{t('marketplace.match')} · </strong>
              {rank.reason}
            </span>
          )}
        </div>
      )}

      <p className="mkt-card-code" onClick={onView} title={t('marketplace.view')}>
        {prompt.content}
      </p>

      {(prompt.tags.length > 0 || prompt.variables.length > 0) && (
        <div className="mkt-card-chips">
          {prompt.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
          {prompt.variables.slice(0, 4).map((v) => (
            <span key={v} className="mkt-var-chip">{`{${v}}`}</span>
          ))}
        </div>
      )}

      <div className="mkt-card-foot">
        <span className="mkt-by" title={t('marketplace.openSource', { source: prompt.source })}>
          <Avatar name={contributor || prompt.source} size={20} />
          <span className="mkt-by-name">
            {contributor || t('marketplace.byUnknown')}
          </span>
        </span>
        <div className="mkt-card-actions">
          <IconButton
            boxed
            size="sm"
            icon={<EyeIcon width={15} height={15} />}
            label={t('marketplace.preview')}
            onClick={onView}
          />
          <IconButton
            boxed
            size="sm"
            icon={copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
            label={copied ? t('marketplace.copied') : t('marketplace.copy')}
            onClick={onCopy}
          />
          {done ? (
            <span className="mkt-added">
              <CheckIcon width={14} height={14} />
              {t('marketplace.added')}
            </span>
          ) : (
            <button
              type="button"
              className="btn-primary btn-inline btn-sm mkt-adopt"
              disabled={state === 'busy' || !!locked}
              title={locked ? t('marketplace.confirmEmailToAdd') : undefined}
              onClick={onAdopt}
            >
              <PlusIcon width={14} height={14} />
              {state === 'busy' ? t('marketplace.adding') : t('marketplace.adopt')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
