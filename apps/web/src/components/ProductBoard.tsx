import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductStatus, type Product } from '@lyra/shared';
import { ImageLightbox } from './ImageLightbox';
import './tasks.css';        // shared kanban chrome (.tboard/.tcol/.tcard) — same as the project task board
import './product-board.css'; // product-specific card extras layered on .tcard

// Ordered column sequence for the product kanban.
export const PRODUCT_STATUS_ORDER: ProductStatus[] = [
  ProductStatus.Candidate,
  ProductStatus.Validating,
  ProductStatus.Testing,
  ProductStatus.Scaling,
  ProductStatus.Declining,
  ProductStatus.Killed,
];

// Token-based tint per status — used for the column-header dot.
export const PRODUCT_STATUS_COLOR: Record<ProductStatus, string> = {
  [ProductStatus.Candidate]:  'var(--ink-tertiary)',
  [ProductStatus.Validating]: 'var(--accent-projects)',
  [ProductStatus.Testing]:    'var(--primary)',
  [ProductStatus.Scaling]:    'var(--success)',
  [ProductStatus.Declining]:  'var(--warning)',
  [ProductStatus.Killed]:     'var(--danger)',
};

function gradeClass(grade?: string): string {
  const g = grade?.[0]?.toUpperCase();
  return g === 'A' ? 'g-a' : g === 'B' ? 'g-b' : g === 'C' ? 'g-c' : '';
}

function groupByStatus(products: Product[]): Record<ProductStatus, Product[]> {
  const out = Object.fromEntries(
    PRODUCT_STATUS_ORDER.map((s) => [s, [] as Product[]]),
  ) as Record<ProductStatus, Product[]>;
  for (const p of products) {
    (out[p.status] ?? out[ProductStatus.Candidate]).push(p);
  }
  return out;
}

// The product kanban — same column/card chrome as the project's task board
// (.tboard/.tcol/.tcard from tasks.css), so they render identically on desktop
// (horizontal columns) and mobile (borderless stacked sections). Product cards
// layer grade + decision + score onto the shared .tcard.
export function ProductBoard({
  products,
  onOpen,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
}) {
  const { t } = useTranslation();
  // Image lightbox: the gallery of one product's images (opened from its card thumb).
  const [lightbox, setLightbox] = useState<string[] | null>(null);

  if (products.length === 0) {
    return (
      <div className="pboard-empty">
        <span className="pboard-empty-ico" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" />
            <path d="M8 2v12M2 5l6 3 6-3" />
          </svg>
        </span>
        <p className="pboard-empty-msg">{t('projects.noProducts')}</p>
      </div>
    );
  }

  const grouped = groupByStatus(products);

  return (
    <>
      <div className="tboard">
        <div className="tboard-cols">
          {PRODUCT_STATUS_ORDER.map((status) => {
            const col = grouped[status];
            return (
              <div className="tcol" key={status}>
                <div className="tcol-head">
                  <span
                    className="pboard-status-dot"
                    style={{ background: PRODUCT_STATUS_COLOR[status] }}
                    aria-hidden="true"
                  />
                  <span className="tcol-name">{t(`projects.productStatus.${status}`)}</span>
                  <span className="tcol-count">{col.length}</span>
                </div>
                <div className="tcol-body">
                  {col.map((product) => {
                    const imgs = product.images ?? [];
                    return (
                      <div
                        key={product.id}
                        className="tcard pcard"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(product)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(product); } }}
                      >
                        <div className="tcard-top">
                          {imgs.length > 0 && (
                            <button
                              type="button"
                              className="pcard-thumb"
                              title={t('products.viewImages')}
                              aria-label={t('products.viewImages')}
                              onClick={(e) => { e.stopPropagation(); setLightbox(imgs); }}
                            >
                              <img src={imgs[0]} alt="" loading="lazy" />
                              {imgs.length > 1 && <span className="pcard-img-count">{imgs.length}</span>}
                            </button>
                          )}
                          <span className="tcard-name">{product.name}</span>
                          {product.grade && (
                            <span className={`pcard-grade ${gradeClass(product.grade)}`} aria-label={t('projects.productGrade')}>
                              {product.grade}
                            </span>
                          )}
                        </div>

                        {(product.niche ?? product.source?.platform) && (
                          <div className="pcard-sub">{product.niche ?? product.source?.platform}</div>
                        )}

                        <div className="tcard-foot">
                          <div className="tcard-foot-l">
                            {product.decision && (
                              <span className="pcard-decision">{product.decision}</span>
                            )}
                          </div>
                          <div className="tcard-foot-r">
                            {product.score !== undefined && (
                              <span className="pcard-score">{product.score}/100</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {lightbox && <ImageLightbox images={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
