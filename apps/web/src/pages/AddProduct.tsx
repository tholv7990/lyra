import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CreateProductDto } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { productsApi } from '../lib/products';
import { useBreadcrumb } from '../layout/breadcrumb';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon } from '../layout/icons';
import './products.css';

// Full-page "Add product" form. Uses the shared EditorShell so its header (logo ·
// crumb · title · ✓ save · ✕ close) matches every other create/edit page in the app.
// The body is a centered column of three numbered panels.
export function AddProduct() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { current } = useWorkspace();
  const ws = current?.id;

  useBreadcrumb(t('products.addProduct'));

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

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!ws || !name.trim() || saving) return;
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
          images: images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        }),
      };
      await productsApi.create(ws, dto);
      navigate('/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.saveFailed'));
      setSaving(false);
    }
  }

  return (
    <EditorShell
      crumb={{ label: t('nav.products'), to: '/products' }}
      onClose={() => navigate('/products')}
      title={<h2 className="eshell-name">{t('products.addProduct')}</h2>}
      actions={
        <button
          type="button"
          className="icon-btn-success"
          title={saving ? t('common.saving') : t('products.addProduct')}
          aria-label={t('products.addProduct')}
          disabled={saving || !name.trim()}
          onClick={() => void handleSubmit()}
        >
          <CheckIcon width={16} height={16} />
        </button>
      }
    >
      <form className="ap-form" onSubmit={(e) => void handleSubmit(e)}>
        {error && <p className="error">{error}</p>}

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

        <span className="ap-enters">
          {t('products.entersAs')}
          <span className="badge"><span className="ap-enters-dot" aria-hidden="true" />{t('projects.productStatus.candidate')}</span>
        </span>
      </form>
    </EditorShell>
  );
}
