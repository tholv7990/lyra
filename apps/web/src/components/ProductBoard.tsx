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

// Grade chip color class: A → success, B → primary, C/lower → warning.
function gradeClass(grade?: string): string {
  if (!grade) return '';
  const g = grade[0]?.toUpperCase();
  if (g === 'A') return 'g-a';
  if (g === 'B') return 'g-b';
  return 'g-c';
}

// Meter band from a 0–100 score: ≥75 high, ≥50 mid, ≥25 low, else very-low.
function meterBand(pct: number): string {
  if (pct >= 75) return 'b-high';
  if (pct >= 50) return 'b-mid';
  if (pct >= 25) return 'b-low';
  return 'b-vlow';
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

// The product kanban board — design/Products Redesign.html.
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
    <div className="board-wrap">
      <div className="board">
        {PRODUCT_STATUS_ORDER.map((status) => {
          const col = grouped[status];
          return (
            <div className="column" key={status}>
              <div className="col-head">
                <span
                  className="col-dot"
                  style={{ background: PRODUCT_STATUS_COLOR[status] }}
                  aria-hidden="true"
                />
                <span className="col-name">{t(`projects.productStatus.${status}`)}</span>
                <span className="col-count">{col.length}</span>
              </div>
              <div className="col-body">
                {col.length === 0 ? (
                  <div className="col-empty">{t('projects.noProducts')}</div>
                ) : (
                  col.map((product) => {
                    const imgCount = product.images?.length ?? 0;
                    const heroImage = product.images?.[0];
                    const scorePct = product.score !== undefined ? Math.max(0, Math.min(100, product.score)) : null;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="pcard"
                        onClick={() => onOpen(product)}
                      >
                        <div className="pcard-top">
                          <span className="thumb">
                            {heroImage ? (
                              <img src={heroImage} alt="" />
                            ) : (
                              <span className="ph-label" aria-hidden="true">
                                {product.niche ?? product.source?.platform ?? 'IMG'}
                              </span>
                            )}
                            {imgCount > 1 && <span className="img-count">{imgCount}</span>}
                          </span>
                          <span className="pcard-id">
                            <span className="pcard-name">{product.name}</span>
                          </span>
                          {product.grade && (
                            <span className={`grade ${gradeClass(product.grade)}`} aria-label={t('projects.productGrade')}>
                              {product.grade}
                            </span>
                          )}
                        </div>

                        {scorePct !== null && (
                          <div className="score-row">
                            <span className={`meter ${meterBand(scorePct)}`} aria-hidden="true">
                              <i style={{ width: `${scorePct}%` }} />
                            </span>
                            <span className="score-val"><b>{product.score}</b>/100</span>
                          </div>
                        )}

                        {product.decision && (
                          <div className="pcard-foot">
                            <span className="pcard-decision">{product.decision}</span>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
