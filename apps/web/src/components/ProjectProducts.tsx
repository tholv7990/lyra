import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, UpdateProductDto } from '@lyra/shared';
import { productsApi, projectProductsApi } from '../lib/products';
import { ProductDetail } from './ProductDetail';
import { MenuPicker, type MenuPickerOption } from './MenuPicker';

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
//   • Click a card → opens the reused ProductDetail modal

export function ProjectProducts({ projectId, workspaceId, initialCopies }: ProjectProductsProps) {
  const { t } = useTranslation();
  const [copies, setCopies] = useState<Product[]>(initialCopies ?? []);
  const [pool, setPool] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const selectedPoolIds = new Set(copies.map((c) => c.poolProductId).filter(Boolean));
  const availablePool = pool.filter((p) => !selectedPoolIds.has(p.id));

  const placeholderOption: MenuPickerOption<string> = {
    value: '',
    label: t('projects.products.select'),
  };
  const pickerOptions: MenuPickerOption<string>[] = [
    placeholderOption,
    ...availablePool.map((p) => ({ value: p.id, label: p.name })),
  ];

  // ── update handler for ProductDetail ──────────────────────────────────────
  async function handleUpdate(patch: UpdateProductDto) {
    if (!selected) return;
    await productsApi.update(workspaceId, selected.id, patch);
    // Refresh the selected product in the modal and in the copies list.
    const updated = await productsApi.get(workspaceId, selected.id);
    setSelected(updated);
    setCopies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  // ── product refresh for ProductDetail (re-load after run finishes) ────────
  async function handleProductRefresh() {
    if (!selected) return;
    const updated = await productsApi.get(workspaceId, selected.id);
    setSelected(updated);
    setCopies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  return (
    <div className="pp-section">
      {/* Section header */}
      <div className="pd-section-head">
        <span className="pd-section-label">
          {t('projects.products.title')}
          <span className="pd-count">{copies.length}</span>
        </span>

        {/* Select picker — only show when there are pool products to add */}
        {availablePool.length > 0 && (
          <MenuPicker<string>
            value=""
            options={pickerOptions}
            onChange={(v) => { if (v) void handleSelect(v); }}
            disabled={selecting}
            ariaLabel={t('projects.products.select')}
          />
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Copy cards */}
      {copies.length === 0 ? (
        <div className="pd-empty-card pd-empty-dashed pd-empty-center">
          <div className="pd-empty-title">{t('projects.products.empty')}</div>
        </div>
      ) : (
        <div className="lib-grid pp-grid">
          {copies.map((copy) => (
            <div
              key={copy.id}
              className={`lib-card pp-card${copy.drift ? ' pp-card--drift' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(copy)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(copy); }}
            >
              {/* Thumbnail */}
              {copy.images?.[0] && (
                <img
                  src={copy.images[0]}
                  alt={copy.name}
                  className="pp-card-img"
                />
              )}

              {/* Card body */}
              <div className="pp-card-body">
                <div className="pp-card-name">{copy.name}</div>

                {/* Price / offer */}
                {(copy.price !== undefined || copy.offer) && (
                  <div className="pp-card-meta">
                    {copy.price !== undefined && (
                      <span className="pp-price">${copy.price}</span>
                    )}
                    {copy.compareAtPrice !== undefined && (
                      <span className="pp-compare">${copy.compareAtPrice}</span>
                    )}
                    {copy.offer && (
                      <span className="pp-offer">{copy.offer}</span>
                    )}
                  </div>
                )}

                {/* Status */}
                <div className="pp-card-status">{copy.status}</div>
              </div>

              {/* Drift badge + refresh */}
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

              {/* Unselect (X) */}
              <button
                type="button"
                className="pp-unselect icon-btn"
                title={t('projects.products.unselect')}
                aria-label={t('projects.products.unselect')}
                onClick={(e) => { e.stopPropagation(); void handleUnselect(copy.id); }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ProductDetail modal for the selected copy */}
      {selected && (
        <ProductDetail
          product={selected}
          workspaceId={workspaceId}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onProductRefresh={handleProductRefresh}
        />
      )}
    </div>
  );
}
