import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tagColor, type Product } from '@lyra/shared';
import { productsApi, projectProductsApi } from '../lib/products';
import { PRODUCT_STATUS_COLOR } from './ProductBoard';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useEscapeKey } from '../lib/useEscapeKey';

function gradeClass(grade?: string): string {
  const g = grade?.[0]?.toUpperCase();
  return g === 'A' ? 'g-a' : g === 'B' ? 'g-b' : g === 'C' ? 'g-c' : '';
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ProjectProductsProps {
  projectId: string;
  workspaceId: string;
  /** Test-only: pre-seed the copies list without hitting the API. */
  initialCopies?: Product[];
}

// ── ProjectProducts ──────────────────────────────────────────────────────────
// Renders the Products section inside a project detail page:
//   • A MenuPicker to select pool products into the project (POST copy)
//   • Copy cards with drift badge + refresh + unselect (X)
//   • Click a card → navigates to the full-page product detail (/products/:id)

export function ProjectProducts({ projectId, workspaceId, initialCopies }: ProjectProductsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copies, setCopies] = useState<Product[]>(initialCopies ?? []);
  const [pool, setPool] = useState<Product[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  useOutsideClick(addRef, addOpen, () => setAddOpen(false));
  useEscapeKey(() => setAddOpen(false), addOpen);

  // ── load copies ────────────────────────────────────────────────────────────
  const loadCopies = useCallback(async () => {
    try {
      const data = await projectProductsApi.list(projectId);
      setCopies(data);
    } catch {
      // non-fatal — already show existing data
    }
  }, [projectId]);

  // ── load pool ──────────────────────────────────────────────────────────────
  const loadPool = useCallback(async () => {
    try {
      const data = await productsApi.list(workspaceId);
      setPool(data);
    } catch {
      // non-fatal
    }
  }, [workspaceId]);

  useEffect(() => {
    // When initialCopies is provided (tests), skip the network fetch for copies.
    if (initialCopies === undefined) {
      void loadCopies();
    }
    void loadPool();
  }, [loadCopies, loadPool, initialCopies]);

  // ── select a pool product ──────────────────────────────────────────────────
  async function handleSelect(poolProductId: string) {
    if (!poolProductId || selecting) return;
    setSelecting(true);
    setError(null);
    try {
      await projectProductsApi.select(projectId, poolProductId);
      await loadCopies();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.actionFailed'));
    } finally {
      setSelecting(false);
    }
  }

  // ── refresh a copy ─────────────────────────────────────────────────────────
  async function handleRefresh(copyId: string) {
    try {
      await projectProductsApi.refresh(projectId, copyId);
      await loadCopies();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.actionFailed'));
    }
  }

  // ── unselect a copy ────────────────────────────────────────────────────────
  async function handleUnselect(copyId: string) {
    try {
      await projectProductsApi.unselect(projectId, copyId);
      setCopies((prev) => prev.filter((c) => c.id !== copyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.actionFailed'));
    }
  }

  // ── picker options: pool products not already selected ────────────────────
  // Only true pool products (no poolProductId and no projectId) may appear in the picker.
  // Copies returned by productsApi.list() would otherwise surface as selectable entries.
  const truePool = pool.filter((p) => !p.poolProductId && !p.projectId);
  const selectedPoolIds = new Set(copies.map((c) => c.poolProductId).filter(Boolean));
  const availablePool = truePool.filter((p) => !selectedPoolIds.has(p.id));

  return (
    <div className="pp-section">
      {/* Section header */}
      <div className="pd-section-head">
        <span className="pd-section-label">
          {t('projects.products.title')}
          <span className="pd-count">{copies.length}</span>
        </span>

        <div className="pd-act pp-actions">
          {/* Select an existing pool product to add — a dropdown, no Create here. */}
          <div className="pp-addwrap" ref={addRef}>
            <button
              type="button"
              className="pp-selbtn"
              aria-haspopup="menu"
              aria-expanded={addOpen}
              disabled={selecting}
              onClick={() => setAddOpen((o) => !o)}
            >
              {t('projects.products.select')}
              <svg className="pp-selcaret" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {addOpen && (
              <div className="lin-menu pp-addmenu" role="menu">
                {availablePool.length === 0 ? (
                  <div className="pp-addempty">{t('projects.products.allAdded')}</div>
                ) : (
                  availablePool.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      className="lin-menu-item"
                      onClick={() => { setAddOpen(false); void handleSelect(p.id); }}
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Copy cards */}
      {copies.length === 0 ? (
        <div className="pd-empty-card pd-empty-dashed pd-empty-center">
          <div className="pd-empty-title">{t('projects.products.empty')}</div>
        </div>
      ) : (
        <div className="lib-grid pp-grid">
          {copies.map((copy) => {
            const imgs = copy.images ?? [];
            const niche = copy.niche ?? copy.source?.platform;
            return (
              <div
                key={copy.id}
                className={`lib-card pp-card${copy.drift ? ' pp-card--drift' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/products/${copy.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/products/${copy.id}`); } }}
              >
                <div className="pp-media">
                  {imgs[0] ? (
                    <div className="pp-thumb">
                      <img src={imgs[0]} alt="" loading="lazy" />
                      {imgs.length > 1 && <span className="pp-thumb-count">{imgs.length}</span>}
                    </div>
                  ) : (
                    <span className="pp-thumb pp-thumb--empty" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M2.5 11l3-3 2.5 2.5L11 7l2.5 2.5" /><circle cx="6" cy="6" r="1" /></svg>
                    </span>
                  )}
                  <div className="pp-headinfo">
                    <h3 className="pp-name">{copy.name}</h3>
                    <span className="pp-status">
                      <span className="pp-status-dot" style={{ background: PRODUCT_STATUS_COLOR[copy.status] }} aria-hidden="true" />
                      {t(`projects.productStatus.${copy.status}`)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pp-unselect icon-btn"
                    title={t('projects.products.unselect')}
                    aria-label={`${t('projects.products.unselect')} — ${copy.name}`}
                    onClick={(e) => { e.stopPropagation(); void handleUnselect(copy.id); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </button>
                </div>

                {(niche || copy.price !== undefined) && (
                  <div className="pp-meta">
                    {niche && (
                      <span className="pp-niche">
                        <span className="pp-niche-dot" style={{ background: tagColor(niche) }} aria-hidden="true" />
                        {niche}
                      </span>
                    )}
                    {copy.price !== undefined && <span className="pp-price">${copy.price}</span>}
                  </div>
                )}

                {copy.score !== undefined && (
                  <div className="pp-verdict">
                    <span className="pp-score">{copy.score}<span className="pp-score-den">/100</span></span>
                    {copy.grade && <span className={`pp-grade ${gradeClass(copy.grade)}`}>{copy.grade}</span>}
                    {copy.decision && <span className="pp-decision">{copy.decision}</span>}
                  </div>
                )}

                {copy.drift && (
                  <div className="pp-drift-row" onClick={(e) => e.stopPropagation()}>
                    <span className="pp-drift-badge">{t('projects.products.drift')}</span>
                    <button
                      type="button"
                      className="btn-ghost btn-inline btn-sm"
                      title={t('projects.products.refresh')}
                      onClick={(e) => { e.stopPropagation(); void handleRefresh(copy.id); }}
                    >
                      {t('projects.products.refresh')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
