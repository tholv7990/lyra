import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StepMode, labelColor, type Pipeline } from '@lyra/shared';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Avatar } from '../components/Avatar';
import { TagChip } from '../components/TagChip';
import { toggleInList } from '../lib/array';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { canCreateIn } from '../lib/perms';
import { useLabels } from '../lib/useLabels';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { BuildWithAiModal } from '../components/BuildWithAiModal';
import { IconButton } from '../components/IconButton';
import { FilterPopover } from '../components/FilterPopover';
import { Pager } from '../components/Pager';
import { CopyIcon, PipelinesIcon, PlusIcon, SearchGlyph, SparkleIcon, TrashIcon } from '../layout/icons';
import './marketplace.css';
import './pipelines.css';

const PAGE_SIZE = 9;

// Tag vocabulary for the filter menu (case-insensitive dedupe, count, sort).
export function pipelineTagVocab(pipelines: Pipeline[]): [string, number][] {
  const byKey = new Map<string, { value: string; count: number }>();
  for (const p of pipelines) {
    for (const tag of p.tags) {
      const key = tag.toLowerCase();
      const existing = byKey.get(key);
      if (existing) existing.count += 1;
      else byKey.set(key, { value: tag, count: 1 });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .map((x) => [x.value, x.count]);
}

// Pure filter predicate: name search + tags (OR) + creator (by id).
export function pipelineMatchesFilters(
  p: Pipeline,
  opts: { q: string; tags: string[]; creators: string[] },
): boolean {
  const query = opts.q.trim().toLowerCase();
  if (query && !p.name.toLowerCase().includes(query)) return false;
  if (opts.tags.length) {
    const selected = new Set(opts.tags.map((t) => t.toLowerCase()));
    if (!p.tags.some((tag) => selected.has(tag.toLowerCase()))) return false;
  }
  if (opts.creators.length && !opts.creators.includes(p.createdBy.id)) return false;
  return true;
}

export function Pipelines() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const mayCreate = canCreateIn(current);
  const { labels } = useLabels(current?.id);
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [creatorFilters, setCreatorFilters] = useState<string[]>([]);
  const [aiOnly, setAiOnly] = useState(false);
  const [gateOnly, setGateOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Pipeline | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toDuplicate, setToDuplicate] = useState<Pipeline | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const wsId = current?.id;
  const tagVocab = useMemo(() => pipelineTagVocab(pipelines), [pipelines]);
  const creatorVocab = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const p of pipelines) {
      const existing = byId.get(p.createdBy.id);
      if (existing) existing.count += 1;
      else byId.set(p.createdBy.id, { ...p.createdBy, count: 1 });
    }
    return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [pipelines]);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Pipeline[]>(`/workspaces/${wsId}/pipelines`)
      .then((list) => !cancelled && setPipelines(list))
      .catch(() => !cancelled && setPipelines([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [wsId]);

  const visible = useMemo(
    () =>
      pipelines.filter((p) => {
        if (!pipelineMatchesFilters(p, { q, tags: tagFilters, creators: creatorFilters })) return false;
        if (aiOnly && p.origin?.source !== 'ai') return false;
        if (gateOnly && !p.steps.some((s) => s.mode === StepMode.Gate)) return false;
        return true;
      }),
    [pipelines, q, tagFilters, creatorFilters, aiOnly, gateOnly],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filterCount = tagFilters.length + creatorFilters.length + (aiOnly ? 1 : 0) + (gateOnly ? 1 : 0);
  const rangeStart = visible.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, visible.length);
  useEffect(() => { setPage(1); }, [q, tagFilters, creatorFilters, aiOnly, gateOnly]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const canEdit = (p: Pipeline) => !!user && (p.createdBy.id === user.id || current?.role === 'owner');

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/pipelines/${toDelete.id}`, { method: 'DELETE' });
      setPipelines((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pipelines.deleteError'));
    } finally {
      setDeleting(false);
    }
  }

  // Duplicate = create a fresh pipeline from a copy of this one (no API endpoint;
  // the server regenerates step ids from the bodies we send). Confirmed first via
  // the duplicate dialog so a stray click can't silently clone a pipeline.
  async function confirmDuplicate() {
    const p = toDuplicate;
    if (!wsId || !p) return;
    setDuplicating(true);
    try {
      const created = await api<Pipeline>(`/workspaces/${wsId}/pipelines`, {
        method: 'POST',
        body: JSON.stringify({
          name: t('pipelines.copyName', { name: p.name }),
          description: p.description,
          tags: p.tags,
          steps: p.steps.map((s) => ({
            name: s.name,
            promptId: s.promptId,
            provider: s.provider,
            model: s.model,
            mode: s.mode,
            fanOut: s.fanOut,
            condition: s.condition,
          })),
          variables: p.variables,
        }),
      });
      setPipelines((list) => [created, ...list]);
      setToDuplicate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pipelines.duplicateError'));
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div>
      <header className="mkt-head">
        <h1>{t('nav.pipelines')}</h1>
        <p>{t('pipelines.subtitle')}</p>
      </header>

      {/* Toolbar — search · Filter · Build with AI · New pipeline */}
      <div className="mkt-toolbar">
        <label className="mkt-search">
          <SearchGlyph />
          <input
            value={q}
            placeholder={t('pipelines.searchPlaceholder')}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('pipelines.searchPlaceholder')}
          />
        </label>
        <FilterPopover
          label={t('pipelines.filterLabel')}
          count={filterCount}
          onClear={() => { setTagFilters([]); setCreatorFilters([]); setAiOnly(false); setGateOnly(false); }}
        >
              <button className="lin-menu-item" onClick={() => setAiOnly((v) => !v)}>
                <SparkleIcon width={14} height={14} />
                {t('pipelines.filterAiOnly')}
                {aiOnly && <span className="lin-menu-check">✓</span>}
              </button>
              <button className="lin-menu-item" onClick={() => setGateOnly((v) => !v)}>
                <span className="dot" style={{ background: 'var(--warning)' }} />
                {t('pipelines.filterGate')}
                {gateOnly && <span className="lin-menu-check">✓</span>}
              </button>
              {tagVocab.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('pipelines.tags')}</span>
                    {tagFilters.length > 0 && <span className="lin-menu-summary-count">{tagFilters.length}</span>}
                  </summary>
                  {tagVocab.map(([tag, count]) => (
                    <button key={tag} className="lin-menu-item" onClick={() => setTagFilters((list) => toggleInList(list, tag))}>
                      <span className="dot" style={{ background: labelColor(tag, labels) }} />
                      {tag} <span className="lin-menu-count">{count}</span>
                      {tagFilters.includes(tag) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
              {creatorVocab.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('pipelines.createdBy')}</span>
                    {creatorFilters.length > 0 && <span className="lin-menu-summary-count">{creatorFilters.length}</span>}
                  </summary>
                  {creatorVocab.map((c) => (
                    <button key={c.id} className="lin-menu-item" onClick={() => setCreatorFilters((list) => toggleInList(list, c.id))}>
                      <span className="dot" style={{ background: labelColor(c.name, []) }} />
                      {c.name} <span className="lin-menu-count">{c.count}</span>
                      {creatorFilters.includes(c.id) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
        </FilterPopover>
        <button type="button" className="btn-ai btn-lg pl-build" onClick={() => setAiOpen(true)}>
          <SparkleIcon width={15} height={15} />
          {t('pipelines.buildWithAi')}
        </button>
        {mayCreate && (
          <button className="btn-primary btn-inline btn-lg pl-new" onClick={() => navigate('/pipelines/new')}>
            <PlusIcon width={15} height={15} />
            {t('pipelines.newPipeline')}
          </button>
        )}
      </div>

      {aiOpen && wsId && <BuildWithAiModal wsId={wsId} onClose={() => setAiOpen(false)} />}

      {!loading && visible.length > 0 && (
        <div className="mkt-meta">
          <span className="mkt-meta-count">
            {t('pipelines.showingRange', { start: rangeStart, end: rangeEnd, total: visible.length })}
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">{t('pipelines.loading')}</p>
      ) : pipelines.length === 0 ? (
        <EmptyState
          icon={<PipelinesIcon width={26} height={26} />}
          title={t('pipelines.emptyTitle')}
          body={t('pipelines.emptyBody')}
          cta={mayCreate ? { label: t('pipelines.newPipeline'), onClick: () => navigate('/pipelines/new') } : undefined}
        />
      ) : visible.length === 0 ? (
        <p className="empty">{t('pipelines.noMatch')}</p>
      ) : (
        <>
          <div className="mkt-grid pl-grid">
            {pageItems.map((p) => (
              <article className="mkt-card pl-card" key={p.id}>
                <div className="pl-card-head">
                  <button type="button" className="mkt-card-title" title={p.name} onClick={() => navigate(`/pipelines/${p.id}`)}>
                    {p.name}
                  </button>
                  <div className="pl-card-badges">
                    <span className="badge step-count">{t('pipelines.steps', { count: p.steps.length })}</span>
                    {p.origin?.source === 'ai' && (
                      <span className="pl-ai" title={p.origin.goal || t('pipelines.aiBuilt')}>
                        <SparkleIcon width={11} height={11} />
                        {t('pipelines.aiBuilt')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step-flow strip */}
                {p.steps.length > 0 && (
                  <div className="pl-flow">
                    {p.steps.map((s, i) => (
                      <span className="pl-flow-item" key={s.id}>
                        <span className="pl-step">
                          <span className="pl-step-n" style={{ background: labelColor(s.provider || s.name, []) }}>{i + 1}</span>
                          <span className="pl-step-name">{s.name}</span>
                          {s.mode === StepMode.Gate && <span className="pl-gate" title={t('pipelines.gateHint')} />}
                        </span>
                        {i < p.steps.length - 1 && <span className="pl-arrow" aria-hidden>›</span>}
                      </span>
                    ))}
                  </div>
                )}

                {p.tags.length > 0 && (
                  <div className="mkt-card-chips">
                    {p.tags.map((tag) => (
                      <TagChip key={tag} label={tag} labels={labels} />
                    ))}
                  </div>
                )}

                <div className="mkt-card-foot">
                  <span className="mkt-by" title={t('pipelines.createdByName', { name: p.createdBy.name })}>
                    <Avatar name={p.createdBy.name} size={20} />
                    <span className="mkt-by-name">{p.createdBy.name} · {fmtDate(p.updatedAt)}</span>
                  </span>
                  <div className="mkt-card-actions">
                    {canEdit(p) && (
                      <IconButton
                        boxed
                        size="sm"
                        icon={<CopyIcon width={15} height={15} />}
                        label={t('pipelines.duplicateNamed', { name: p.name })}
                        onClick={() => setToDuplicate(p)}
                      />
                    )}
                    {canEdit(p) && (
                      <IconButton
                        boxed
                        size="sm"
                        variant="danger"
                        icon={<TrashIcon width={15} height={15} />}
                        label={t('pipelines.deleteNamed', { name: p.name })}
                        onClick={() => setToDelete(p)}
                      />
                    )}
                    <button type="button" className="pl-open" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M4.5 3.2 12 8l-7.5 4.8Z" /></svg>
                      {t('pipelines.open')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('pipelines.deleteConfirmTitle')}
        message={<>{t('pipelines.deleteConfirmBefore')}<strong>{toDelete?.name}</strong>{t('pipelines.deleteConfirmAfter')}</>}
        confirmLabel={t('common.delete')}
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={!!toDuplicate}
        title={t('pipelines.duplicateConfirmTitle')}
        message={<>{t('pipelines.duplicateConfirmBefore')}<strong>{toDuplicate?.name}</strong>{t('pipelines.duplicateConfirmAfter')}</>}
        confirmLabel={t('common.duplicate')}
        busy={duplicating}
        onConfirm={() => void confirmDuplicate()}
        onCancel={() => setToDuplicate(null)}
      />
    </div>
  );
}
