import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tagColor, type Product, type ProductStatus } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { productsApi } from '../lib/products';
import { ProductBoard, PRODUCT_STATUS_ORDER, PRODUCT_STATUS_COLOR } from '../components/ProductBoard';
import { ProductGallery } from '../components/ProductGallery';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterPopover } from '../components/FilterPopover';
import { Pager } from '../components/Pager';
import { MenuPicker } from '../components/MenuPicker';
import { EmptyState } from '../components/EmptyState';
import { toggleInList } from '../lib/array';
import { PlusIcon, SearchGlyph } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './marketplace.css';
import './products.css';

// ── Products page ────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const GRADES = ['A', 'B', 'C'] as const;
type View = 'board' | 'gallery';
type Sort = 'score' | 'updated' | 'price' | 'name';

export function Products() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { current } = useWorkspace();
  const ws = current?.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Board (status Kanban) vs Gallery (filterable/paged grid). Remembered locally.
  const [view, setView] = useState<View>(() => {
    try { return (localStorage.getItem('lyra.products.view') as View) || 'board'; } catch { return 'board'; }
  });
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<ProductStatus[]>([]);
  const [fNiche, setFNiche] = useState<string[]>([]);
  const [fCategory, setFCategory] = useState<string[]>([]);
  const [fGrade, setFGrade] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('score');
  const [page, setPage] = useState(1);

  useBreadcrumb(null);

  const refresh = useCallback(async () => {
    if (!ws) return;
    try {
      setProducts(await productsApi.list(ws));
    } catch {
      setProducts([]);
    }
  }, [ws]);

  useEffect(() => { void refresh(); }, [refresh]);

  function chooseView(v: View) {
    setView(v);
    try { localStorage.setItem('lyra.products.view', v); } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!ws || !confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await productsApi.remove(ws, confirmDelete.id);
      setConfirmDelete(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  // Filter vocab derived from the loaded products.
  const niches = useMemo(
    () => [...new Set(products.map((p) => p.niche).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  // Client-side filter + sort (product counts are small; no API change needed).
  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = products.filter((p) => {
      if (query && !`${p.name} ${p.niche ?? ''} ${p.category ?? ''} ${p.description ?? ''}`.toLowerCase().includes(query)) return false;
      if (fStatus.length && !fStatus.includes(p.status)) return false;
      if (fNiche.length && !(p.niche && fNiche.includes(p.niche))) return false;
      if (fCategory.length && !(p.category && fCategory.includes(p.category))) return false;
      if (fGrade.length && !(p.grade && fGrade.includes(p.grade[0]?.toUpperCase() ?? ''))) return false;
      return true;
    });
    arr.sort((a, b) => {
      if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'price') return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    });
    return arr;
  }, [products, q, fStatus, fNiche, fCategory, fGrade, sort]);

  const filterCount = fStatus.length + fNiche.length + fCategory.length + fGrade.length;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = visible.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, visible.length);

  useEffect(() => { setPage(1); }, [q, fStatus, fNiche, fCategory, fGrade, sort]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function clearFilters() { setFStatus([]); setFNiche([]); setFCategory([]); setFGrade([]); }

  return (
    <div className="products-page">
      <div className="lin-toolbar">
        <h1 className="lin-toolbar-title">{t('products.title')}</h1>
        {products.length > 0 && (
          <span className="lin-toolbar-note">
            {t('products.trackedNote', { n: products.length, stages: PRODUCT_STATUS_ORDER.length })}
          </span>
        )}

        <div className="pv-seg" role="group" aria-label={t('products.viewLabel')}>
          <button
            type="button"
            className={`pv-seg-btn${view === 'board' ? ' active' : ''}`}
            aria-pressed={view === 'board'}
            onClick={() => chooseView('board')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="1.5" y="2.5" width="3.5" height="11" rx="1" /><rect x="6.25" y="2.5" width="3.5" height="11" rx="1" /><rect x="11" y="2.5" width="3.5" height="11" rx="1" /></svg>
            {t('products.viewBoard')}
          </button>
          <button
            type="button"
            className={`pv-seg-btn${view === 'gallery' ? ' active' : ''}`}
            aria-pressed={view === 'gallery'}
            onClick={() => chooseView('gallery')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
            {t('products.viewGallery')}
          </button>
        </div>

        {view === 'board' && (
          <button
            type="button"
            className="btn-primary btn-inline btn-sm"
            onClick={() => navigate('/products/new')}
          >
            <PlusIcon width={13} height={13} />
            <span>{t('products.addProduct')}</span>
          </button>
        )}
      </div>

      {view === 'gallery' && (
        <>
          <div className="mkt-toolbar">
            <label className="mkt-search">
              <SearchGlyph />
              <input
                value={q}
                placeholder={t('products.searchPlaceholder')}
                aria-label={t('products.searchPlaceholder')}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <FilterPopover label={t('products.filterLabel')} count={filterCount} onClear={clearFilters}>
              <div className="lin-menu-label">{t('products.fStatus')}</div>
              {PRODUCT_STATUS_ORDER.map((s) => (
                <button key={s} className="lin-menu-item" onClick={() => setFStatus((l) => toggleInList(l, s))}>
                  <span className="dot" style={{ background: PRODUCT_STATUS_COLOR[s] }} />
                  {t(`projects.productStatus.${s}`)}
                  {fStatus.includes(s) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              <div className="lin-menu-label">{t('products.fGrade')}</div>
              {GRADES.map((g) => (
                <button key={g} className="lin-menu-item" onClick={() => setFGrade((l) => toggleInList(l, g))}>
                  {t('products.gradeLabel', { grade: g })}
                  {fGrade.includes(g) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              {niches.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('products.fNiche')}</span>
                    {fNiche.length > 0 && <span className="lin-menu-summary-count">{fNiche.length}</span>}
                  </summary>
                  {niches.map((n) => (
                    <button key={n} className="lin-menu-item" onClick={() => setFNiche((l) => toggleInList(l, n))}>
                      <span className="dot" style={{ background: tagColor(n) }} />
                      {n}
                      {fNiche.includes(n) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
              {categories.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('products.fCategory')}</span>
                    {fCategory.length > 0 && <span className="lin-menu-summary-count">{fCategory.length}</span>}
                  </summary>
                  {categories.map((c) => (
                    <button key={c} className="lin-menu-item" onClick={() => setFCategory((l) => toggleInList(l, c))}>
                      {c}
                      {fCategory.includes(c) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
            </FilterPopover>
            <button
              type="button"
              className="btn-primary btn-inline btn-sm prodg-add"
              onClick={() => navigate('/products/new')}
              title={t('products.addProduct')}
            >
              <PlusIcon width={14} height={14} />
              <span className="prodg-add-label">{t('products.addProduct')}</span>
            </button>
          </div>
          {visible.length > 0 && (
            <div className="mkt-meta">
              <span className="mkt-meta-count">{t('products.showingRange', { start: rangeStart, end: rangeEnd, total: visible.length })}</span>
              <div className="prodg-sort">
                <span className="prodg-sort-label">{t('products.sortLabel')}</span>
                <MenuPicker<Sort>
                  value={sort}
                  options={[
                    { value: 'score', label: t('products.sortScore') },
                    { value: 'updated', label: t('products.sortUpdated') },
                    { value: 'price', label: t('products.sortPrice') },
                    { value: 'name', label: t('products.sortName') },
                  ]}
                  onChange={setSort}
                  ariaLabel={t('products.sortLabel')}
                />
              </div>
            </div>
          )}
        </>
      )}

      {view === 'board' ? (
        <ProductBoard
          products={products}
          onOpen={(p) => navigate(`/products/${p.id}`)}
          onEdit={(p) => navigate(`/products/${p.id}/edit`)}
          onDelete={(p) => setConfirmDelete(p)}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={(
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" /><path d="M8 2v12M2 5l6 3 6-3" /></svg>
          )}
          title={products.length === 0 ? t('projects.noProducts') : t('products.noMatchTitle')}
          body={products.length === 0 ? t('products.emptyBody') : t('products.noMatchBody')}
          cta={products.length === 0
            ? { label: t('products.addProduct'), onClick: () => navigate('/products/new') }
            : filterCount > 0 || q ? { label: t('common.clear'), onClick: () => { clearFilters(); setQ(''); } } : undefined}
        />
      ) : (
        <div className="prodg-wrap">
          <ProductGallery
            products={pageItems}
            onOpen={(p) => navigate(`/products/${p.id}`)}
            onEdit={(p) => navigate(`/products/${p.id}/edit`)}
            onDelete={(p) => setConfirmDelete(p)}
          />
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('products.deleteTitle')}
        message={<><strong>{confirmDelete?.name}</strong>{t('products.deleteMessage')}</>}
        confirmLabel={t('common.delete')}
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
