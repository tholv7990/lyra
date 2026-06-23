import { useTranslation } from 'react-i18next';
import { ProductStatus, type Product } from '@lyra/shared';
import './product-board.css';

// Ordered column sequence for the product kanban.
export const PRODUCT_STATUS_ORDER: ProductStatus[] = [
  ProductStatus.Candidate,
  ProductStatus.Validating,
  ProductStatus.Testing,
  ProductStatus.Scaling,
  ProductStatus.Declining,
  ProductStatus.Killed,
];

// Token-based tint per status — used for the column header dot.
export const PRODUCT_STATUS_COLOR: Record<ProductStatus, string> = {
  [ProductStatus.Candidate]:  'var(--ink-tertiary)',
  [ProductStatus.Validating]: 'var(--accent-projects)',
  [ProductStatus.Testing]:    'var(--primary)',
  [ProductStatus.Scaling]:    'var(--success)',
  [ProductStatus.Declining]:  'var(--warning)',
  [ProductStatus.Killed]:     'var(--danger)',
};

function groupByStatus(products: Product[]): Record<ProductStatus, Product[]> {
  const out = Object.fromEntries(
    PRODUCT_STATUS_ORDER.map((s) => [s, [] as Product[]]),
  ) as Record<ProductStatus, Product[]>;
  for (const p of products) {
    (out[p.status] ?? out[ProductStatus.Candidate]).push(p);
  }
  return out;
}

// The product kanban board — mirrors TaskList column layout.
// Props are pure data: the page owns loading; this is a pure render.
export function ProductBoard({
  products,
  onOpen,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
}) {
  const { t } = useTranslation();

  if (products.length === 0) {
    return (
      <div className="pboard-empty">
        <span className="pboard-empty-ico" aria-hidden="true">
          {/* box / product icon */}
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
    <div className="pboard">
      <div className="pboard-cols">
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
                {col.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="tcard pcard"
                    onClick={() => onOpen(product)}
                  >
                    <div className="tcard-top">
                      <span className="tcard-name">{product.name}</span>
                      {product.grade && (
                        <span className="pcard-grade" aria-label={t('projects.productGrade')}>
                          {product.grade}
                        </span>
                      )}
                    </div>

                    {(product.niche ?? product.source?.platform) && (
                      <div className="pcard-sub">
                        {product.niche ?? product.source?.platform}
                      </div>
                    )}

                    <div className="pcard-foot">
                      {product.decision && (
                        <span className="pcard-decision">{product.decision}</span>
                      )}
                      {product.score !== undefined && (
                        <span className="pcard-score">{product.score}/100</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
