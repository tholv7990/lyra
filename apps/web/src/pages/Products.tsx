import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, CreateProductDto, UpdateProductDto } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { productsApi } from '../lib/products';
import { ProductBoard } from '../components/ProductBoard';
import { ProductDetail } from '../components/ProductDetail';
import { Modal } from '../components/Modal';
import { PlusIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './products.css';

// ── Add-product form dialog ──────────────────────────────────────────────────

function AddProductModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (dto: CreateProductDto) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [offer, setOffer] = useState('');
  const [source, setSource] = useState('');
  const [images, setImages] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const dto: CreateProductDto = {
        name: name.trim(),
        ...(niche.trim() && { niche: niche.trim() }),
        ...(category.trim() && { category: category.trim() }),
        ...(price && { price: parseFloat(price) }),
        ...(compareAtPrice && { compareAtPrice: parseFloat(compareAtPrice) }),
        ...(offer.trim() && { offer: offer.trim() }),
        ...(source.trim() && { source: { url: source.trim() } }),
        ...(images.trim() && {
          images: images
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      };
      await onSave(dto);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} className="add-product-modal">
      <div className="mkd-head">
        <h2 className="mkd-title">{t('products.addProduct')}</h2>
        <button
          type="button"
          className="mkd-close"
          onClick={onClose}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <form className="mkd-body" onSubmit={(e) => void handleSubmit(e)}>
        {error && <p className="form-error">{error}</p>}

        <div className="field">
          <label className="field-label" htmlFor="ap-name">{t('products.fieldName')}</label>
          <input
            id="ap-name"
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('products.fieldNamePlaceholder')}
            required
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="ap-niche">{t('products.fieldNiche')}</label>
            <input
              id="ap-niche"
              className="field-input"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder={t('products.fieldNichePlaceholder')}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ap-category">{t('products.fieldCategory')}</label>
            <input
              id="ap-category"
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('products.fieldCategoryPlaceholder')}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="ap-price">{t('products.fieldPrice')}</label>
            <input
              id="ap-price"
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ap-compare">{t('products.fieldCompareAtPrice')}</label>
            <input
              id="ap-compare"
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ap-offer">{t('products.fieldOffer')}</label>
          <input
            id="ap-offer"
            className="field-input"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder={t('products.fieldOfferPlaceholder')}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ap-source">{t('products.fieldSource')}</label>
          <input
            id="ap-source"
            className="field-input"
            type="url"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ap-images">{t('products.fieldImages')}</label>
          <textarea
            id="ap-images"
            className="field-input field-textarea"
            value={images}
            onChange={(e) => setImages(e.target.value)}
            placeholder={t('products.fieldImagesPlaceholder')}
            rows={3}
          />
          <span className="field-hint">{t('products.fieldImagesHint')}</span>
        </div>

        <div className="mkd-foot">
          <button type="button" className="btn-ghost btn-inline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary btn-inline" disabled={saving || !name.trim()}>
            {saving ? t('common.saving') : t('products.addProduct')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Products page ────────────────────────────────────────────────────────────

export function Products() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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

  async function handleCreate(dto: CreateProductDto) {
    if (!ws) return;
    await productsApi.create(ws, dto);
    await refresh();
  }

  async function handleUpdate(patch: UpdateProductDto) {
    if (!ws || !selected) return;
    const updated = await productsApi.update(ws, selected.id, patch);
    setSelected(updated);
    await refresh();
  }

  return (
    <div className="products-page">
      <div className="lin-toolbar">
        <h1 className="lin-toolbar-title">{t('products.title')}</h1>
        <button
          type="button"
          className="btn-primary btn-inline btn-sm"
          onClick={() => setAddOpen(true)}
        >
          <PlusIcon width={13} height={13} />
          <span>{t('products.addProduct')}</span>
        </button>
      </div>

      <ProductBoard products={products} onOpen={setSelected} />

      {selected && ws && (
        <ProductDetail
          product={selected}
          workspaceId={ws}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onProductRefresh={refresh}
        />
      )}

      {addOpen && (
        <AddProductModal
          onClose={() => setAddOpen(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}
