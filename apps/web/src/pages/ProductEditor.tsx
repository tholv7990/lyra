import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CreateProductDto, UpdateProductDto } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { productsApi } from '../lib/products';
import { useBreadcrumb } from '../layout/breadcrumb';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon } from '../layout/icons';
import './products.css';

// Full-page product create + edit form. `/products/new` creates; `/products/:id/edit`
// edits (prefilled, saved via PATCH). Uses the shared EditorShell so the header
// matches every other create/edit page; the body is a column of numbered panels.
export function ProductEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { current } = useWorkspace();
  const ws = current?.id;

  useBreadcrumb(isEdit ? t('products.editProduct') : t('products.addProduct'));

  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [offer, setOffer] = useState('');
  const [source, setSource] = useState('');
  const [images, setImages] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  // Import bar (create only): paste a product link → crawl + LLM-map → prefill.
  const [importUrlInput, setImportUrlInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Edit mode: load the product and prefill the form.
  useEffect(() => {
    if (!isEdit || !ws || !id) return;
    let cancelled = false;
    setLoading(true);
    productsApi.get(ws, id)
      .then((p) => {
        if (cancelled) return;
        setName(p.name ?? '');
        setNiche(p.niche ?? '');
        setCategory(p.category ?? '');
        setDescription(p.description ?? '');
        setPrice(p.price !== undefined ? String(p.price) : '');
        setCompareAtPrice(p.compareAtPrice !== undefined ? String(p.compareAtPrice) : '');
        setOffer(p.offer ?? '');
        setSource(p.source?.url ?? '');
        setImages((p.images ?? []).join('\n'));
      })
      .catch(() => { if (!cancelled) setError(t('common.notFound')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isEdit, ws, id, t]);

  async function handleImport() {
    if (!ws || !importUrlInput.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      const result = await productsApi.importUrl(ws, importUrlInput.trim());
      if (result.name !== undefined) setName(result.name);
      if (result.price !== undefined) setPrice(String(result.price));
      if (result.compareAtPrice !== undefined) setCompareAtPrice(String(result.compareAtPrice));
      if (result.offer !== undefined) setOffer(result.offer);
      if (result.niche !== undefined) setNiche(result.niche);
      if (result.category !== undefined) setCategory(result.category);
      if (result.description !== undefined) setDescription(result.description);
      if (result.images && result.images.length) setImages(result.images.join('\n'));
      if (result.source?.url) setSource(result.source.url);
      setImportWarnings(result.warnings ?? []);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('products.importFailed'));
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!ws || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        // Edit: the form is the desired state of these fields. Send strings as-is
        // (empty clears them); numbers only when present (clearing a number is rare).
        const patch: UpdateProductDto = {
          name: name.trim(),
          niche: niche.trim(),
          category: category.trim(),
          description: description.trim(),
          offer: offer.trim(),
          source: { url: source.trim() },
          images: images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          ...(price.trim() ? { price: parseFloat(price) } : {}),
          ...(compareAtPrice.trim() ? { compareAtPrice: parseFloat(compareAtPrice) } : {}),
        };
        await productsApi.update(ws, id, patch);
        navigate(`/products/${id}`);
      } else {
        const dto: CreateProductDto = {
          name: name.trim(),
          ...(niche.trim() && { niche: niche.trim() }),
          ...(category.trim() && { category: category.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(price && { price: parseFloat(price) }),
          ...(compareAtPrice && { compareAtPrice: parseFloat(compareAtPrice) }),
          ...(offer.trim() && { offer: offer.trim() }),
          ...(source.trim() && { source: { url: source.trim() } }),
          ...(images.trim() && {
            images: images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          }),
        };
        await productsApi.create(ws, dto);
        navigate('/products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.saveFailed'));
      setSaving(false);
    }
  }

  const backTo = isEdit && id ? `/products/${id}` : '/products';

  if (loading) {
    return (
      <EditorShell
        crumb={{ label: t('nav.products'), to: '/products' }}
        onClose={() => navigate(backTo)}
        title={<h2 className="eshell-name">{t('common.loading')}</h2>}
      >
        <div className="ap-form" />
      </EditorShell>
    );
  }

  return (
    <EditorShell
      crumb={{ label: t('nav.products'), to: '/products' }}
      onClose={() => navigate(backTo)}
      title={<h2 className="eshell-name">{isEdit ? t('products.editProduct') : t('products.addProduct')}</h2>}
      actions={
        <button
          type="button"
          className="icon-btn-success"
          title={saving ? t('common.saving') : t('common.save')}
          aria-label={t('common.save')}
          disabled={saving || !name.trim()}
          onClick={() => void handleSubmit()}
        >
          <CheckIcon width={16} height={16} />
        </button>
      }
    >
      <form className="ap-form" onSubmit={(e) => void handleSubmit(e)}>
        {error && <p className="error">{error}</p>}

        {/* Import from a product link — crawl + prefill (create only) */}
        {!isEdit && (
          <section className="ap-import">
            <span className="field-label ap-import-label">{t('products.importTitle')}</span>
            <div className="ap-import-row">
              <input
                className="text-input"
                type="url"
                value={importUrlInput}
                onChange={(e) => setImportUrlInput(e.target.value)}
                placeholder={t('products.importPlaceholder')}
                disabled={importing}
              />
              <button
                type="button"
                className="btn-primary btn-inline"
                onClick={() => void handleImport()}
                disabled={importing || !importUrlInput.trim()}
              >
                {importing ? t('products.importing') : t('products.importBtn')}
              </button>
            </div>
            <span className="ap-import-hint">{t('products.importHint')}</span>
            {importError && <p className="error">{importError}</p>}
            {importWarnings.map((w, i) => (
              <p key={i} className="ap-import-warn">{w}</p>
            ))}
          </section>
        )}

        {/* 1 · Product */}
        <section className="panel">
          <div className="panel-head"><span className="step">1</span><span className="pn">{t('products.panelProduct')}</span></div>
          <div className="panel-pad">
            <label className="field full">
              <span className="field-label">{t('products.fieldName')}<i className="field-req">*</i></span>
              <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('products.fieldNamePlaceholder')} autoFocus required />
            </label>
            <div className="fields-grid">
              <label className="field">
                <span className="field-label">{t('products.fieldNiche')}</span>
                <input className="text-input" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder={t('products.fieldNichePlaceholder')} />
              </label>
              <label className="field">
                <span className="field-label">{t('products.fieldCategory')}</span>
                <input className="text-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('products.fieldCategoryPlaceholder')} />
              </label>
            </div>
            <label className="field full">
              <span className="field-label">{t('products.fieldDescription')}</span>
              <textarea className="text-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('products.fieldDescriptionPlaceholder')} rows={3} style={{ resize: 'vertical' }} />
            </label>
          </div>
        </section>

        {/* 2 · Pricing */}
        <section className="panel">
          <div className="panel-head"><span className="step">2</span><span className="pn">{t('products.panelPricing')}</span></div>
          <div className="panel-pad">
            <div className="fields-grid">
              <label className="field">
                <span className="field-label">{t('products.fieldPrice')}</span>
                <span className="affix"><span className="pre">$</span><input className="text-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="89.00" /></span>
              </label>
              <label className="field">
                <span className="field-label">{t('products.fieldCompareAtPrice')}</span>
                <span className="affix"><span className="pre">$</span><input className="text-input" inputMode="decimal" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="129.00" /></span>
              </label>
            </div>
            <label className="field full">
              <span className="field-label">{t('products.fieldOffer')}</span>
              <input className="text-input" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={t('products.fieldOfferPlaceholder')} />
            </label>
          </div>
        </section>

        {/* 3 · Sourcing & media */}
        <section className="panel">
          <div className="panel-head"><span className="step">3</span><span className="pn">{t('products.panelSourcing')}</span></div>
          <div className="panel-pad">
            <label className="field full">
              <span className="field-label">{t('products.fieldSource')}</span>
              <span className="affix">
                <span className="pre ic" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.8.8" /><path d="M9.5 6.5a2.5 2.5 0 00-3.5 0l-2 2a2.5 2.5 0 003.5 3.5l.8-.8" /></svg>
                </span>
                <input className="text-input" type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://supplier.com/item…" />
              </span>
            </label>
            <label className="field full" style={{ marginTop: 16 }}>
              <span className="field-label">{t('products.fieldImages')}</span>
              <div className="dropzone-note">
                <span className="dz-ic" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M2.5 11l3-3 2.5 2.5L11 7l2.5 2.5" /><circle cx="6" cy="6" r="1" /></svg>
                </span>
                <span className="dz-txt"><strong>{t('products.addImagesTitle')}</strong><span>{t('products.addImagesSub')}</span></span>
              </div>
              <textarea className="text-input dz-area" value={images} onChange={(e) => setImages(e.target.value)} placeholder={'https://…/front.jpg\nhttps://…/side.jpg'} />
            </label>
          </div>
        </section>

        {!isEdit && (
          <span className="ap-enters">
            {t('products.entersAs')}
            <span className="badge"><span className="ap-enters-dot" aria-hidden="true" />{t('projects.productStatus.candidate')}</span>
          </span>
        )}
      </form>
    </EditorShell>
  );
}
