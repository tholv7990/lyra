import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tagColor, type Product } from '@lyra/shared';
import { fmtDate } from '../lib/format';
import { PRODUCT_STATUS_COLOR } from './ProductBoard';
import { ImageLightbox } from './ImageLightbox';
import './product-gallery.css';

function gradeClass(grade?: string): string {
  const g = grade?.[0]?.toUpperCase();
  return g === 'A' ? 'g-a' : g === 'B' ? 'g-b' : g === 'C' ? 'g-c' : '';
}

// Gallery view of the product list — a filterable/paged card grid (the .mkt-grid
// gallery shared with the other list pages), an alternative to the status Kanban.
// Each card surfaces the decision-making signals: image · name · status · the
// verdict (score/grade/decision) · niche · price, with edit/delete actions.
export function ProductGallery({
  products,
  onOpen,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const { t } = useTranslation();
  const [lightbox, setLightbox] = useState<string[] | null>(null);

  return (
    <>
      <div className="mkt-grid prodg-grid">
        {products.map((p) => {
          const imgs = p.images ?? [];
          const niche = p.niche ?? p.source?.platform;
          return (
            <article
              key={p.id}
              className="mkt-card prodg-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p); } }}
            >
              <div className="prodg-media">
                {imgs.length > 0 ? (
                  <button
                    type="button"
                    className="prodg-thumb"
                    title={t('products.viewImages')}
                    aria-label={t('products.viewImages')}
                    onClick={(e) => { e.stopPropagation(); setLightbox(imgs); }}
                  >
                    <img src={imgs[0]} alt="" loading="lazy" />
                    {imgs.length > 1 && <span className="prodg-img-count">{imgs.length}</span>}
                  </button>
                ) : (
                  <span className="prodg-thumb prodg-thumb--empty" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M2.5 11l3-3 2.5 2.5L11 7l2.5 2.5" /><circle cx="6" cy="6" r="1" /></svg>
                  </span>
                )}
                <div className="prodg-headinfo">
                  <h3 className="prodg-name">{p.name}</h3>
                  <span className="prodg-status">
                    <span className="prodg-status-dot" style={{ background: PRODUCT_STATUS_COLOR[p.status] }} aria-hidden="true" />
                    {t(`projects.productStatus.${p.status}`)}
                  </span>
                </div>
              </div>

              <div className="prodg-meta">
                {niche && (
                  <span className="prodg-niche">
                    <span className="prodg-niche-dot" style={{ background: tagColor(niche) }} aria-hidden="true" />
                    {niche}
                  </span>
                )}
                {p.price !== undefined && <span className="prodg-price">${p.price}</span>}
              </div>

              {p.score !== undefined ? (
                <div className="prodg-verdict">
                  <span className="prodg-score">{p.score}<span className="prodg-score-den">/100</span></span>
                  {p.grade && <span className={`prodg-grade ${gradeClass(p.grade)}`}>{p.grade}</span>}
                  {p.decision && <span className="prodg-decision">{p.decision}</span>}
                </div>
              ) : (
                <div className="prodg-verdict prodg-verdict--none">{t('projects.notScored')}</div>
              )}

              <div className="prodg-foot">
                <span className="prodg-date">{fmtDate(p.updatedAt)}</span>
                <div className="prodg-actions">
                  <button
                    type="button"
                    className="prodg-act"
                    title={t('products.edit')}
                    aria-label={`${t('products.edit')} — ${p.name}`}
                    onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" /></svg>
                  </button>
                  <button
                    type="button"
                    className="prodg-act prodg-act--danger"
                    title={t('common.delete')}
                    aria-label={`${t('common.delete')} — ${p.name}`}
                    onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3.2h3v1.3M4.8 4.5l.5 8h5.4l.5-8" /></svg>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {lightbox && <ImageLightbox images={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
