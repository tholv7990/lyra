import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PromptStatus,
  Provider,
  defaultModel,
  labelColor,
  type ConversationSummary,
  type Paged,
  type ProviderCount,
  type PromptAuthorCount,
  type PromptSort,
  type PromptType,
  type PromptTypeCount,
  type Prompt,
  type TagCount,
} from '@lyra/shared';
import { api } from '../lib/api';
import { fmtDate, initials } from '../lib/format';
import { useOutsideClick } from '../lib/useOutsideClick';
import { PROVIDER_LABELS, STATUS_COLOR } from '../lib/constants';
import { toggleInList } from '../lib/array';
import { TYPE_COLOR } from '../lib/promptType';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { canCreateIn } from '../lib/perms';
import { useLabels } from '../lib/useLabels';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PromptDetails } from '../components/PromptDetails';
import { ProviderIcon } from '../components/ProviderIcon';
import {
  ChatsIcon,
  FilterIcon,
  PencilIcon,
  PromptsIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from '../layout/icons';
import { IconButton } from '../components/IconButton';
import './marketplace.css';
import './prompts.css';

const PAGE_SIZE = 15;

interface PromptQueryOptions {
  page: number;
  limit: number;
  statuses: PromptStatus[];
  tags: string[];
  createdBy: string[];
  providers: Provider[];
  types: PromptType[];
  q: string;
  sort: PromptSort;
}

export function buildPromptQuery({
  page,
  limit,
  statuses,
  tags,
  createdBy,
  providers,
  types,
  q,
  sort,
}: PromptQueryOptions) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  statuses.forEach((s) => params.append('status', s));
  tags.forEach((t) => params.append('tag', t));
  createdBy.forEach((id) => params.append('createdBy', id));
  providers.forEach((p) => params.append('provider', p));
  types.forEach((ty) => params.append('type', ty));
  if (q.trim()) params.set('q', q.trim());
  params.set('sort', sort);
  return params.toString();
}

// Inline search glyph (no shared SearchIcon yet) — matches the design's search box.
function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.4 10.4 3 3" />
    </svg>
  );
}

export function Prompts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const wsId = current?.id;
  const mayCreate = canCreateIn(current);
  const { labels } = useLabels(wsId);
  const statusLabel = (s: PromptStatus) =>
    s === PromptStatus.Public ? t('prompts.statusPublic') : t('prompts.statusDraft');

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Type is a single-select pill row; status/tags/providers/creators live in the
  // Filter popover; sort drives the order.
  const [type, setType] = useState<PromptType | ''>('');
  const [statuses, setStatuses] = useState<PromptStatus[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [createdBy, setCreatedBy] = useState<string[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sort, setSort] = useState<PromptSort>('updated');
  const [q, setQ] = useState('');

  const [vocab, setVocab] = useState<TagCount[]>([]);
  const [creators, setCreators] = useState<PromptAuthorCount[]>([]);
  const [providerVocab, setProviderVocab] = useState<[Provider, number][]>([]);
  const [typeVocab, setTypeVocab] = useState<PromptTypeCount[]>([]);
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [toDelete, setToDelete] = useState<Prompt | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number | null>(null);
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // The Filter popover holds status/tags/providers/creators (type is a pill row).
  const filterCount = statuses.length + tags.length + createdBy.length + providers.length;
  const hasFilters = filterCount > 0 || !!type || !!q.trim();
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  useEffect(() => setPage(1), [statuses, tags, createdBy, providers, type, sort, q]);

  useOutsideClick(filterRef, filterMenu, () => setFilterMenu(false));

  const buildQuery = () =>
    buildPromptQuery({
      page,
      limit: PAGE_SIZE,
      statuses,
      tags,
      createdBy,
      providers,
      types: type ? [type] : [],
      q,
      sort,
    });

  // Filter vocabularies span the WHOLE visible library (never the current page)
  // so options stay stable as you narrow.
  const loadVocab = useCallback(() => {
    if (!wsId) return;
    api<TagCount[]>(`/workspaces/${wsId}/prompts/tags`).then(setVocab).catch(() => undefined);
    api<PromptAuthorCount[]>(`/workspaces/${wsId}/prompts/creators`).then(setCreators).catch(() => undefined);
    api<ProviderCount[]>(`/workspaces/${wsId}/prompts/providers`)
      .then((list) => setProviderVocab(list.map((x) => [x.provider, x.count] as [Provider, number])))
      .catch(() => undefined);
    api<PromptTypeCount[]>(`/workspaces/${wsId}/prompts/types`).then(setTypeVocab).catch(() => undefined);
  }, [wsId]);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    const query = buildQuery();
    const timer = setTimeout(() => {
      api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${query}`)
        .then((res) => {
          if (cancelled) return;
          setPrompts(res.items);
          setTotal(res.total);
        })
        .catch(() => !cancelled && setPrompts([]))
        .finally(() => !cancelled && setLoading(false));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wsId, page, statuses, tags, createdBy, providers, type, sort, q]);

  useEffect(loadVocab, [loadVocab]);

  const canEdit = (p: Prompt) => !!user && p.createdBy.id === user.id;

  function reload() {
    if (!wsId) return;
    api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${buildQuery()}`)
      .then((res) => { setPrompts(res.items); setTotal(res.total); })
      .catch(() => undefined);
  }

  async function openInChat(p: Prompt) {
    const prov = p.provider ?? Provider.Anthropic;
    const from = { label: t('prompts.breadcrumb'), to: '/prompts', record: p.title };
    try {
      const existing = await api<ConversationSummary | null>(
        `/workspaces/${wsId}/conversations/prompt-history`,
        { method: 'POST', body: JSON.stringify({ promptId: p.id, content: p.content }) },
      );
      if (existing) {
        navigate(`/chats/${existing.id}`, { state: { from } });
        return;
      }
    } catch {
      // fall through to a draft chat
    }
    navigate('/chats', {
      state: {
        seed: p.content,
        provider: prov,
        model: p.model ?? defaultModel(prov),
        originPromptId: p.id,
        from,
      },
    });
  }

  function askDelete(p: Prompt) {
    setToDelete(p);
    setDeleteUsage(null);
    if (wsId) {
      api<{ count: number }>(`/workspaces/${wsId}/pipelines/prompt-usage/${p.id}`)
        .then((r) => setDeleteUsage(r.count))
        .catch(() => setDeleteUsage(null));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/prompts/${toDelete.id}`, { method: 'DELETE' });
      setToDelete(null);
      setDeleteUsage(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('prompts.errDelete'));
    } finally {
      setDeleting(false);
    }
  }

  // Type pills: All (visible total) + each type with its count.
  const typeTotal = typeVocab.reduce((n, x) => n + x.count, 0);
  const typePills = [
    { key: '' as PromptType | '', label: t('prompts.allTypes'), count: typeTotal },
    ...typeVocab.map((x) => ({ key: x.type, label: t(`prompts.type.${x.type}`), count: x.count })),
  ];

  return (
    <div className="pl-page">
      <header className="mkt-head">
        <h1>{t('prompts.heading')}</h1>
        <p>{t('prompts.subtitle')}</p>
      </header>

      {/* Toolbar — search · Filter · New prompt */}
      <div className="mkt-toolbar">
        <label className="mkt-search">
          <SearchGlyph />
          <input
            value={q}
            placeholder={t('prompts.searchPlaceholder')}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('prompts.searchPlaceholder')}
          />
        </label>
        <div className="mkt-filter" ref={filterRef}>
          <button
            type="button"
            className={`mkt-tool-btn${filterCount > 0 || filterMenu ? ' active' : ''}`}
            aria-expanded={filterMenu}
            aria-haspopup="true"
            onClick={() => setFilterMenu((s) => !s)}
          >
            <FilterIcon width={15} height={15} />
            {t('prompts.filter')}
            {filterCount > 0 && <span className="mkt-filter-count">{filterCount}</span>}
          </button>
          {filterMenu && (
            <div className="lin-menu">
              <div className="lin-menu-actions">
                <button
                  type="button"
                  className="lin-menu-clear"
                  disabled={filterCount === 0}
                  onClick={() => {
                    setStatuses([]);
                    setTags([]);
                    setProviders([]);
                    setCreatedBy([]);
                  }}
                >
                  {t('common.clear')}
                </button>
              </div>
              <div className="lin-menu-label">{t('prompts.filterStatus')}</div>
              {[PromptStatus.Draft, PromptStatus.Public].map((s) => (
                <button key={s} className="lin-menu-item" onClick={() => setStatuses((list) => toggleInList(list, s))}>
                  <span className="dot" style={{ background: STATUS_COLOR[s] }} />
                  {statusLabel(s)}
                  {statuses.includes(s) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              <details className="lin-menu-section">
                <summary className="lin-menu-summary">
                  <span>{t('prompts.filterTags')}</span>
                  {tags.length > 0 && <span className="lin-menu-summary-count">{tags.length}</span>}
                </summary>
                {vocab.length === 0 && <div className="lin-menu-empty">{t('prompts.noPromptTags')}</div>}
                {vocab.map((tg) => (
                  <button key={tg.value} className="lin-menu-item" onClick={() => setTags((list) => toggleInList(list, tg.value))}>
                    <span className="dot" style={{ background: labelColor(tg.value, labels) }} />
                    {tg.value} <span className="lin-menu-count">{tg.count}</span>
                    {tags.includes(tg.value) && <span className="lin-menu-check">✓</span>}
                  </button>
                ))}
              </details>
              {providerVocab.length > 0 && <div className="lin-menu-label">{t('prompts.filterProvider')}</div>}
              {providerVocab.map(([provider, count]) => (
                <button key={provider} className="lin-menu-item" onClick={() => setProviders((list) => toggleInList(list, provider))}>
                  <ProviderIcon provider={provider} size={14} />
                  {PROVIDER_LABELS[provider]} <span className="lin-menu-count">{count}</span>
                  {providers.includes(provider) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              {creators.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('prompts.filterCreatedBy')}</span>
                    {createdBy.length > 0 && <span className="lin-menu-summary-count">{createdBy.length}</span>}
                  </summary>
                  {creators.map((creator) => (
                    <button key={creator.id} className="lin-menu-item" onClick={() => setCreatedBy((list) => toggleInList(list, creator.id))}>
                      <span className="dot" style={{ background: labelColor(creator.name, []) }} />
                      {creator.name} <span className="lin-menu-count">{creator.count}</span>
                      {createdBy.includes(creator.id) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>
        {mayCreate && (
          <button className="btn-primary btn-inline btn-lg pl-new" onClick={() => navigate('/prompts/new')}>
            <PlusIcon width={15} height={15} />
            {t('prompts.newPrompt')}
          </button>
        )}
      </div>

      {/* Type pills */}
      {typePills.length > 1 && (
        <div className="mkt-pills">
          {typePills.map((p) => (
            <button
              key={p.key || 'all'}
              type="button"
              className={`mkt-pill${type === p.key ? ' active' : ''}`}
              onClick={() => setType(p.key)}
            >
              {p.label}
              <span className="mkt-pill-count">{p.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result meta + sort */}
      {!loading && total > 0 && (
        <div className="mkt-meta">
          <span className="mkt-meta-count">
            {t('prompts.showingRange', { start: rangeStart, end: rangeEnd, total })}
          </span>
          <label className="mkt-sort">
            {t('prompts.sortLabel')}
            <select
              className="mkt-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as PromptSort)}
            >
              <option value="updated">{t('prompts.sortUpdated')}</option>
              <option value="az">{t('prompts.sortAz')}</option>
            </select>
          </label>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">{t('prompts.loadingPrompts')}</p>
      ) : prompts.length === 0 ? (
        !hasFilters ? (
          <EmptyState
            icon={<PromptsIcon width={26} height={26} />}
            title={t('prompts.emptyTitle')}
            body={t('prompts.emptyBody')}
            cta={mayCreate ? { label: t('prompts.emptyCta'), onClick: () => navigate('/prompts/new') } : undefined}
          />
        ) : (
          <p className="empty">{t('prompts.noMatch')}</p>
        )
      ) : (
        <>
          <div className="mkt-grid">
            {prompts.map((p) => {
              const editable = canEdit(p);
              const saved = p.results?.length ?? 0;
              return (
                <article className="mkt-card" key={p.id}>
                  <div className="pl-card-head">
                    <button
                      type="button"
                      className="mkt-card-title"
                      title={t('prompts.viewFullPrompt')}
                      onClick={() => setDetailPrompt(p)}
                    >
                      {p.title}
                    </button>
                    <span className={`badge status-${p.status}`}>{statusLabel(p.status)}</span>
                  </div>

                  <div className="pl-card-meta">
                    <span className="pl-type">
                      <span className="mkt-dot" style={{ background: TYPE_COLOR[p.type] }} />
                      {t(`prompts.type.${p.type}`)}
                    </span>
                    {saved > 0 && (
                      <span className="pl-saved">
                        <SparkleIcon width={12} height={12} />
                        {t('prompts.savedCount', { count: saved })}
                      </span>
                    )}
                  </div>

                  {p.content && (
                    <p className="mkt-card-code" onClick={() => setDetailPrompt(p)} title={t('prompts.viewFullPrompt')}>
                      {p.content}
                    </p>
                  )}

                  {p.tags.length > 0 && (
                    <div className="mkt-card-chips">
                      {p.tags.map((tag) => (
                        <span key={tag} className="mkt-chip">
                          <span className="mkt-dot" style={{ background: labelColor(tag, labels) }} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mkt-card-foot">
                    <span className="mkt-by">
                      <span
                        className="mkt-by-avatar"
                        style={{ background: labelColor(p.createdBy.name, []), color: 'var(--on-accent)' }}
                        aria-hidden
                      >
                        {initials(p.createdBy.name)}
                      </span>
                      <span className="mkt-by-name">
                        {p.createdBy.name} · {fmtDate(p.updatedAt)}
                      </span>
                    </span>
                    <div className="mkt-card-actions">
                      <IconButton
                        boxed
                        size="sm"
                        icon={<ChatsIcon width={15} height={15} />}
                        label={t('prompts.openInChatNamed', { title: p.title })}
                        onClick={() => void openInChat(p)}
                      />
                      {editable && (
                        <IconButton
                          boxed
                          size="sm"
                          icon={<PencilIcon width={15} height={15} />}
                          label={t('prompts.editNamed', { title: p.title })}
                          onClick={() => navigate(`/prompts/${p.id}`)}
                        />
                      )}
                      {editable && (
                        <IconButton
                          boxed
                          size="sm"
                          variant="danger"
                          icon={<TrashIcon width={15} height={15} />}
                          label={t('prompts.deletePromptNamed', { title: p.title })}
                          onClick={() => askDelete(p)}
                        />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mkt-pager">
              <button type="button" className="mkt-page-btn" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                ‹ {t('prompts.prev')}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`mkt-page-num${n === page ? ' active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button type="button" className="mkt-page-btn" disabled={page >= totalPages} onClick={() => setPage((n) => n + 1)}>
                {t('prompts.next')} ›
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('prompts.deleteTitle')}
        message={
          <>
            <strong>{toDelete?.title}</strong> {t('prompts.deleteRemoved')}
            {deleteUsage != null && deleteUsage > 0 && (
              <span className="confirm-warn">
                ⚠ {t('prompts.deleteUsageWarn', { count: deleteUsage })}
              </span>
            )}
          </>
        }
        confirmLabel={t('common.delete')}
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => { setToDelete(null); setDeleteUsage(null); }}
      />
      {detailPrompt && (
        <PromptDetails
          prompt={detailPrompt}
          labels={labels}
          onOpenInChat={() => void openInChat(detailPrompt)}
          onClose={() => setDetailPrompt(null)}
        />
      )}
    </div>
  );
}
