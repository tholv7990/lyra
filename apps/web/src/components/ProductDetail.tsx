import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductStatus, type Product, type UpdateProductDto } from '@lyra/shared';
import { Modal } from './Modal';
import { MenuPicker, type MenuPickerOption } from './MenuPicker';
import { PRODUCT_STATUS_COLOR } from './ProductBoard';
import './product-detail.css';

// ── Status picker options ───────────────────────────────────────────────────

const STATUS_ORDER: ProductStatus[] = [
  ProductStatus.Candidate,
  ProductStatus.Validating,
  ProductStatus.Testing,
  ProductStatus.Scaling,
  ProductStatus.Declining,
  ProductStatus.Killed,
];

// ── Confidence-kind chip color (token-only) ─────────────────────────────────

const KIND_CLASS: Record<string, string> = {
  verified:   'pdtl-kind pdtl-kind--verified',
  calculated: 'pdtl-kind pdtl-kind--calculated',
  estimate:   'pdtl-kind pdtl-kind--estimate',
  assumption: 'pdtl-kind pdtl-kind--assumption',
};

// ── Shared props ────────────────────────────────────────────────────────────

interface Props {
  product: Product;
  onClose: () => void;
  onUpdate: (patch: UpdateProductDto) => Promise<void>;
}

// ── ProductDetailBody ───────────────────────────────────────────────────────
// Presentational body — no portal/hooks that require a DOM. Exported so tests
// can render it with renderToStaticMarkup; ProductDetail wraps it in <Modal>.

export function ProductDetailBody({ product, onClose, onUpdate }: Props) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState(product.outcome ?? '');
  const [savingOutcome, setSavingOutcome] = useState(false);

  // Build the status picker options with the i18n label + a colored dot icon.
  const statusOptions: MenuPickerOption<ProductStatus>[] = STATUS_ORDER.map((s) => ({
    value: s,
    label: t(`projects.productStatus.${s}`),
    icon: (
      <span
        className="pdtl-status-dot"
        style={{ background: PRODUCT_STATUS_COLOR[s] }}
        aria-hidden="true"
      />
    ),
  }));

  async function handleStatusChange(status: ProductStatus) {
    await onUpdate({ status });
  }

  async function handleOutcomeBlur() {
    const trimmed = outcome.trim();
    if (trimmed === (product.outcome ?? '').trim()) return;
    setSavingOutcome(true);
    try {
      await onUpdate({ outcome: trimmed || undefined });
    } finally {
      setSavingOutcome(false);
    }
  }

  // Primary source URL (first primary, else first alive, else first)
  const primarySource =
    product.sources.find((s) => s.primary) ??
    product.sources.find((s) => s.alive) ??
    product.sources[0];

  return (
    <div className="pdtl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="pdtl-head">
        <div className="pdtl-head-top">
          <div className="pdtl-title-row">
            <h2 className="pdtl-title">{product.name}</h2>
            {product.niche && (
              <span className="pdtl-niche">{product.niche}</span>
            )}
            {primarySource?.url && (
              <a
                href={primarySource.url}
                className="pdtl-src-link"
                target="_blank"
                rel="noreferrer"
                title={primarySource.name}
              >
                ↗
              </a>
            )}
          </div>

          <div className="pdtl-head-actions">
            {/* Score + grade */}
            {product.score !== undefined && (
              <span className="pdtl-score">{product.score}/100</span>
            )}
            {product.grade && (
              <span className="pdtl-grade" aria-label={t('projects.productGrade')}>
                {product.grade}
              </span>
            )}
            {/* Decision pill — raw key is visible; translated label is the tooltip */}
            {product.decision && (
              <span
                className="pdtl-decision"
                title={t(`projects.productDecision.${product.decision}`, { defaultValue: product.decision })}
              >
                {product.decision}
              </span>
            )}
            {/* Status picker */}
            <MenuPicker<ProductStatus>
              value={product.status}
              options={statusOptions}
              onChange={handleStatusChange}
              ariaLabel={t('projects.statusAria')}
            />
            {/* Close */}
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
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="pdtl-body">

        {/* Evidence claims */}
        {product.evidence.length > 0 && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.evidenceTitle')}</h3>
            <ul className="pdtl-evidence-list">
              {product.evidence.map((claim) => {
                const src = product.sources.find((s) => s.id === claim.sourceId);
                return (
                  <li key={claim.id} className="pdtl-claim">
                    <div className="pdtl-claim-top">
                      <span className="pdtl-claim-stmt">{claim.statement}</span>
                      <span className={KIND_CLASS[claim.kind] ?? 'pdtl-kind'}>
                        {claim.kind}
                      </span>
                    </div>
                    <div className="pdtl-claim-meta">
                      {claim.geography && (
                        <span className="pdtl-claim-geo">{claim.geography}</span>
                      )}
                      {claim.period && (
                        <span className="pdtl-claim-period">{claim.period}</span>
                      )}
                      {src?.url && (
                        <a
                          href={src.url}
                          className="pdtl-claim-src"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {src.name}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Sources */}
        {product.sources.length > 0 && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.sourcesTitle')}</h3>
            <ul className="pdtl-source-list">
              {product.sources.map((src) => (
                <li key={src.id} className="pdtl-source">
                  <a
                    href={src.url}
                    className="pdtl-source-name"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {src.name}
                  </a>
                  <span className="pdtl-source-date">{src.accessDate}</span>
                  {src.primary && (
                    <span className="pdtl-primary-tag">{t('projects.primaryTag')}</span>
                  )}
                  <span className={`pdtl-alive ${src.alive ? 'pdtl-alive--yes' : 'pdtl-alive--no'}`}>
                    {src.alive ? t('projects.aliveBadge') : t('projects.deadBadge')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Unit economics — omitted when absent */}
        {product.unitEcon && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.unitEconTitle')}</h3>
            <dl className="pdtl-econ">
              <div className="pdtl-econ-row">
                <dt>CM1</dt>
                <dd>${product.unitEcon.cm1} ({Math.round(product.unitEcon.cm1Pct * 100)}%)</dd>
              </div>
              <div className="pdtl-econ-row">
                <dt>{t('projects.breakEvenRoas')}</dt>
                <dd>{product.unitEcon.breakEvenRoas}×</dd>
              </div>
              <div className="pdtl-econ-row">
                <dt>{t('projects.maxCac')}</dt>
                <dd>${product.unitEcon.maxCac}</dd>
              </div>
              <div className="pdtl-econ-row">
                <dt>{t('projects.targetRoas')}</dt>
                <dd>{product.unitEcon.targetRoas}×</dd>
              </div>
            </dl>
          </section>
        )}

        {/* Outcome textarea */}
        <section className="pdtl-section">
          <h3 className="pdtl-section-label">{t('projects.outcomeTitle')}</h3>
          <div className="pdtl-outcome-wrap">
            <textarea
              className="pdtl-outcome"
              value={outcome}
              placeholder={t('projects.outcomePlaceholder')}
              rows={3}
              onChange={(e) => setOutcome(e.target.value)}
              onBlur={() => void handleOutcomeBlur()}
              disabled={savingOutcome}
            />
          </div>
        </section>

      </div>
    </div>
  );
}

// ── ProductDetail ────────────────────────────────────────────────────────────
// Modal-wrapped version for use in pages.

export function ProductDetail(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <Modal onClose={props.onClose} className="pdtl-modal">
      <div ref={ref}>
        <ProductDetailBody {...props} />
      </div>
    </Modal>
  );
}
