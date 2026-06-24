import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductStatus, Provider, StepStatus, WEIGHTS, decideWithReason, type Asset, type Product, type Run, type SavedResult, type ScoreKey, type UpdateProductDto } from '@lyra/shared';
import { api } from '../lib/api';
import { productsApi, productResultsApi } from '../lib/products';
import { productRunsApi } from '../lib/productRuns';
import { useWorkspace } from '../workspace/useWorkspace';
import { useBreadcrumb } from '../layout/breadcrumb';
import { useRunActions } from '../lib/useRunActions';
import { EditorShell } from './EditorShell';
import { PencilIcon } from '../layout/icons';
import { MenuPicker, type MenuPickerOption } from './MenuPicker';
import { RunTimeline } from './RunTimeline';
import { PRODUCT_STATUS_COLOR } from './ProductBoard';
import type { StepHistoryEntry } from './StepResultModal';
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

// ── Visual band helpers (map to the design's grade / meter color classes) ────

// Grade chip color: A → success, B → primary, C/lower → warning.
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

// Ring stroke color token matching the meter band.
const BAND_STROKE: Record<string, string> = {
  'b-high': 'var(--success)',
  'b-mid':  'var(--primary)',
  'b-low':  'var(--warning)',
  'b-vlow': 'var(--danger)',
};

// ── Collapsible section ─────────────────────────────────────────────────────
// Native <details>: on mobile the deep research sections collapse so the page
// stays a short, scannable list (progressive disclosure); on desktop CSS forces
// them open and hides the toggle, so the desktop layout is unchanged. No JS,
// no library — the platform does the work, and the content always renders in the
// DOM (so renderToStaticMarkup tests still see it).
function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="panel pd-sec">
      <summary className="panel-head">
        <h2>{title}</h2>
        <span className="pd-sec-toggle" aria-hidden="true">
          <svg className="pd-sec-plus" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3.25v9.5M3.25 8h9.5" />
          </svg>
        </span>
      </summary>
      <div className="panel-pad">{children}</div>
    </details>
  );
}

// ── Shared props ────────────────────────────────────────────────────────────

interface Props {
  product: Product;
  workspaceId: string;
  /** Optional — the page hosts the body in EditorShell, which owns close/back. */
  onClose?: () => void;
  onUpdate: (patch: UpdateProductDto) => Promise<void>;
  onProductRefresh: () => Promise<void>;
}

// ── ProductDetailBody ───────────────────────────────────────────────────────
// Presentational body — no portal/hooks that require a DOM. Exported so tests
// can render it with renderToStaticMarkup; ProductDetailPage hosts it full-page.

export function ProductDetailBody({ product, workspaceId, onUpdate, onProductRefresh }: Props) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState(product.outcome ?? '');
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [runAssets, setRunAssets] = useState<Asset[]>([]);

  // Re-sync from the stored e-commerce source URL.
  const [resyncing, setResyncing] = useState(false);
  const [resyncNote, setResyncNote] = useState<string | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);

  // Copy-product extras
  const [brandingRuns, setBrandingRuns] = useState<Run[]>([]);
  const [poolProduct, setPoolProduct] = useState<Product | null>(null);
  const [savingResult, setSavingResult] = useState<string | null>(null); // step key being saved

  const { busy, error: runError, runAll, runStep, approve, savePrompt, regenerate } = useRunActions(run, setRun);

  // Fetch assets whenever the active run changes.
  useEffect(() => {
    if (!run) { setRunAssets([]); return; }
    let cancelled = false;
    api<Asset[]>(`/runs/${run.id}/assets`)
      .then((a) => { if (!cancelled) setRunAssets(a); })
      .catch(() => { if (!cancelled) setRunAssets([]); });
    return () => { cancelled = true; };
  }, [run]);

  // When run reaches done, refresh the product so enriched research fields show.
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (run?.status === 'done' && prevStatusRef.current !== 'done') {
      void onProductRefresh();
    }
    prevStatusRef.current = run?.status;
  }, [run?.status, onProductRefresh]);

  // For a copy product: load branding runs + pool product research.
  useEffect(() => {
    if (!product.poolProductId) return;
    let cancelled = false;

    productRunsApi.list(workspaceId, product.id)
      .then((rs) => { if (!cancelled) setBrandingRuns(rs); })
      .catch(() => { if (!cancelled) setBrandingRuns([]); });

    productsApi.get(workspaceId, product.poolProductId)
      .then((p) => { if (!cancelled) setPoolProduct(p); })
      .catch(() => { if (!cancelled) setPoolProduct(null); });

    return () => { cancelled = true; };
  }, [product.id, product.poolProductId, workspaceId]);

  // historyForStep: no-op for now (no multi-run history per product yet).
  const historyForStep = (_i: number): StepHistoryEntry[] => [];

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

  async function handleResync() {
    if (resyncing) return;
    setResyncing(true);
    setResyncError(null);
    setResyncNote(null);
    try {
      await productsApi.resync(workspaceId, product.id);
      await onProductRefresh();
      setResyncNote(t('products.resynced'));
    } catch (e) {
      setResyncError(e instanceof Error ? e.message : t('products.resyncFailed'));
    } finally {
      setResyncing(false);
    }
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

  async function handleRunResearch() {
    if (starting || busy) return;
    setStarting(true);
    setStartError(null);
    try {
      const r = await productRunsApi.start(workspaceId, product.id);
      setRun(r);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : t('products.runError'));
    } finally {
      setStarting(false);
    }
  }

  // Save a specific run step result to this product's results array.
  async function handleSaveToProduct(stepIndex: number) {
    if (!run) return;
    const step = run.steps[stepIndex];
    if (!step) return;
    const key = `${run.id}-${stepIndex}`;
    setSavingResult(key);
    try {
      // Find first asset for this step (image/video).
      const stepAssets = runAssets.filter((a) => a.stepIndex === stepIndex);
      const firstAsset = stepAssets[0];
      await productResultsApi.save(workspaceId, product.id, {
        output: step.result ?? '',
        provider: (step.provider ?? Provider.Anthropic) as Provider,
        model: step.model ?? '',
        assetUrl: firstAsset?.url,
        assetType: firstAsset ? (firstAsset.type as 'image' | 'video' | 'audio') : undefined,
        runId: run.id,
        stepIndex,
      });
      await onProductRefresh();
    } finally {
      setSavingResult(null);
    }
  }

  async function handleRemoveResult(resultId: string) {
    await productResultsApi.remove(workspaceId, product.id, resultId);
    await onProductRefresh();
  }

  // Primary source URL (first primary, else first alive, else first)
  const primarySource =
    product.sources.find((s) => s.primary) ??
    product.sources.find((s) => s.alive) ??
    product.sources[0];

  const isBusy = busy || starting;
  const displayError = startError ?? runError;

  // Steps with results that can be saved (done + has result or asset).
  const saveableSteps = run
    ? run.steps
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => s.status === StepStatus.Done && (s.result || runAssets.some((a) => a.stepIndex === i)))
    : [];

  const isCopy = !!product.poolProductId;

  // Explainability: per-factor breakdown + the reason the decision landed where it did.
  const factorRows = product.subScores
    ? (Object.keys(WEIGHTS) as ScoreKey[]).map((k) => {
        // Clamp once, then derive both points and bar width from the clamped value —
        // matches weightedScore so a malformed sub-score can't print >weight or a >100% bar.
        const sub = Math.max(0, Math.min(5, product.subScores![k] ?? 0));
        return { key: k, sub, weight: WEIGHTS[k], contribution: Math.round(WEIGHTS[k] * (sub / 5) * 10) / 10 };
      })
    : [];
  const decisionReason =
    product.score !== undefined && product.hardGates
      ? decideWithReason(product.score, product.hardGates, product.subScores).reason
      : null;

  // Gallery: main shot + strip (static — first image is the main shot).
  const galleryImages = product.images ?? [];

  // Score ring geometry (presentational): a 96px ring with a 42px radius.
  const scorePct = product.score !== undefined ? Math.max(0, Math.min(100, product.score)) : null;
  const RING_R = 42;
  const RING_C = 2 * Math.PI * RING_R;
  const ringBand = scorePct !== null ? meterBand(scorePct) : 'b-mid';

  const hasRisk = !!product.riskFlags && (product.riskFlags.unresolvedSafety || product.riskFlags.materialIpRisk || product.riskFlags.misleadingClaimsRequired || (!!product.riskNotes && product.riskNotes.length > 0));
  const hasPricing = product.price !== undefined || product.compareAtPrice !== undefined || !!product.offer;
  // The hero carries the headline econ stats; the aside only shows the genuinely
  // deeper view (the CM1 formula + the sensitivity table) when those exist.
  const hasEconFormula = !!product.unitEconInputs && typeof product.unitEconInputs.aov === 'number';
  const hasDeepEcon = !!product.unitEcon && (hasEconFormula || !!product.scenarios);
  const hasAside = hasDeepEcon || isCopy;

  return (
    <div className="pd-detail">
      {/* Primary actions — status + run research (+ source). Title/back live in
          the EditorShell header provided by ProductDetailPage. */}
      <div className="pd-actions-row">
        <MenuPicker<ProductStatus>
          value={product.status}
          options={statusOptions}
          onChange={handleStatusChange}
          ariaLabel={t('projects.statusAria')}
        />
        {!isCopy && (
          <button
            type="button"
            className="btn-primary btn-inline btn-sm"
            disabled={isBusy}
            onClick={() => void handleRunResearch()}
          >
            {starting ? t('products.running') : t('products.runResearch')}
          </button>
        )}
        {product.source?.url && (
          <button
            type="button"
            className="btn-ghost btn-inline btn-sm"
            disabled={resyncing}
            title={t('products.resyncHint')}
            onClick={() => void handleResync()}
          >
            {resyncing ? t('products.resyncing') : t('products.resync')}
          </button>
        )}
        {primarySource?.url && (
          <a
            href={primarySource.url}
            className="pdtl-src-link pd-actions-src"
            target="_blank"
            rel="noreferrer"
            title={primarySource.name}
          >
            {primarySource.name} ↗
          </a>
        )}
      </div>
      {resyncError && <p className="error">{resyncError}</p>}
      {resyncNote && <p className="pd-resync-note">{resyncNote}</p>}

      {/* ── Hero ──────────────────────────────────────────────────────────────
          Verdict-forward product hero on one subtle surface: gallery left; right
          column leads with the decision verdict, then pricing, a 3-up econ stat
          row, and the description. Mobile stacks media over info. The name lives
          in the EditorShell header (not repeated here). */}
      <div className="pdtl-hero">
        <div className="pdtl-hero-media">
          <div className="gallery">
            {galleryImages[0] ? (
              <>
                <div className="main-shot">
                  <img src={galleryImages[0]} alt="" />
                </div>
                {galleryImages.length > 1 && (
                  <div className="strip">
                    {galleryImages.slice(0, 6).map((src, i) => (
                      <div key={i} className={`t${i === 0 ? ' active' : ''}`}>
                        <img src={src} alt="" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="pdtl-shot-empty">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span className="pdtl-shot-empty-label">{t('products.noImages')}</span>
                <a className="pdtl-shot-empty-add" href={`/products/${product.id}/edit`}>{t('products.addImagesLink')}</a>
              </div>
            )}
          </div>
        </div>

        <div className="pdtl-hero-info">
          {(product.niche || product.category) && (
            <div className="pdtl-hero-meta">
              {product.niche && <span className="pdtl-chip">{product.niche}</span>}
              {product.category && <span className="pdtl-chip pdtl-chip--soft">{product.category}</span>}
            </div>
          )}

          {/* Verdict — the research answer, leading the column */}
          {scorePct !== null ? (
            <div className="score-hero">
              <div className="score-ring">
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle cx="48" cy="48" r={RING_R} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
                  <circle
                    cx="48"
                    cy="48"
                    r={RING_R}
                    fill="none"
                    stroke={BAND_STROKE[ringBand]}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - scorePct / 100)}
                  />
                </svg>
                <div className="rnum">{product.score}</div>
                <div className="rden">/100</div>
              </div>
              <div className="score-info">
                <div className="lbl">{t('products.decisionScore')}</div>
                <div className="grade-row">
                  {product.grade && (
                    <span className={`grade-big ${gradeClass(product.grade)}`} aria-label={t('projects.productGrade')}>
                      {product.grade}
                    </span>
                  )}
                  <div className="grade-txt">
                    {product.decision && (
                      <div className="g1" title={t(`projects.productDecision.${product.decision}`, { defaultValue: product.decision })}>{product.decision}</div>
                    )}
                    {decisionReason && <div className="g2">{t('projects.decisionReason', { reason: decisionReason })}</div>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>{t('projects.notScored')}</p>
          )}

          {hasPricing && (
            <div className="pdtl-pricing">
              {product.price !== undefined && <span className="pdtl-price">${product.price}</span>}
              {product.compareAtPrice !== undefined && <span className="pdtl-compare">${product.compareAtPrice}</span>}
              {product.offer && <span className="pdtl-offer">{product.offer}</span>}
            </div>
          )}

          {product.unitEcon && (
            <dl className="pdtl-stats">
              <div className="pdtl-stat">
                <dt className="pdtl-stat-k">{t('products.factCm1')}</dt>
                <dd className="pdtl-stat-v">${product.unitEcon.cm1.toFixed(2)} <small>({Math.round(product.unitEcon.cm1Pct * 100)}%)</small></dd>
              </div>
              <div className="pdtl-stat">
                <dt className="pdtl-stat-k">{t('products.factBreakEven')}</dt>
                <dd className="pdtl-stat-v">{product.unitEcon.breakEvenRoas.toFixed(2)}×</dd>
              </div>
              <div className="pdtl-stat">
                <dt className="pdtl-stat-k">{t('products.factMaxCac')}</dt>
                <dd className="pdtl-stat-v">${product.unitEcon.maxCac.toFixed(2)}</dd>
              </div>
              <div className="pdtl-stat">
                <dt className="pdtl-stat-k">{t('projects.targetRoas')}</dt>
                <dd className="pdtl-stat-v">{product.unitEcon.targetRoas.toFixed(2)}×</dd>
              </div>
            </dl>
          )}

          {product.description && <p className="pdtl-hero-desc">{product.description}</p>}
        </div>
      </div>

      {/* ── Body — 2-column on desktop when there's aside content, else a single
          centered column; stacked on mobile. ─────────────────────────────────── */}
      <div className={`pdtl-body${hasAside ? '' : ' pdtl-body--single'}`}>
        {/* ── Narrative column ─────────────────────────────────────────────── */}
        <div className="pd-main">
          {displayError && <p className="error">{displayError}</p>}

          {/* Why this score — per-factor breakdown */}
          {factorRows.length > 0 && (
            <Section title={t('projects.scoreBreakdownTitle')}>
              <ul className="pdtl-factors break-list">
                {factorRows.map((f) => {
                  const fillPct = (f.contribution / f.weight) * 100;
                  return (
                    <li key={f.key} className="pdtl-factor break-row">
                      <span className="pdtl-factor-name nm">{t(`projects.factorLabels.${f.key}`)}</span>
                      <span className={`meter ${meterBand(fillPct)}`} aria-hidden="true">
                        <i style={{ width: `${fillPct}%` }} />
                      </span>
                      <span className="pdtl-factor-sub five">{f.sub}/5</span>
                      <span className="pdtl-factor-pts pts">{f.contribution}/{f.weight}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Research run timeline — interactive; visible whenever a run exists */}
          {run && run.steps.length > 0 && (
            <section className="panel pd-timeline">
              <div className="panel-pad">
                <RunTimeline
                  run={run}
                  busy={isBusy}
                  hasKey={() => true}
                  onRunStep={runStep}
                  onApprove={(i) => {
                    approve(i);
                    void onProductRefresh();
                  }}
                  onSavePrompt={savePrompt}
                  onRegenerate={regenerate}
                  assets={runAssets}
                  historyForStep={historyForStep}
                />
                {isCopy && saveableSteps.length > 0 && (
                  <div className="pdtl-save-actions">
                    {saveableSteps.map(({ s, i }) => {
                      const key = `${run.id}-${i}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          className="btn-ghost btn-inline btn-sm"
                          disabled={savingResult === key}
                          onClick={() => void handleSaveToProduct(i)}
                        >
                          {t('products.saveToProduct')} — {s.name ?? `Step ${i + 1}`}
                        </button>
                      );
                    })}
                  </div>
                )}
                {run.steps.every((s) => s.status === StepStatus.Idle) && (
                  <div className="pdtl-run-start">
                    <button
                      type="button"
                      className="btn-primary btn-inline btn-sm"
                      disabled={isBusy}
                      onClick={runAll}
                    >
                      {t('run.runAll')}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Evidence — FAQ accordion; each claim expands to its source reference
              (with live/dead status). Sources are merged here, not a separate list. */}
          {product.evidence.length > 0 ? (
            <Section title={t('projects.evidenceTitle')}>
              <div className="pdtl-faq-list">
                {product.evidence.map((claim) => {
                  const src = product.sources.find((s) => s.id === claim.sourceId);
                  return (
                    <details key={claim.id} className="pdtl-faq">
                      <summary>
                        <span className="pdtl-faq-q">{claim.statement}</span>
                        <span className={KIND_CLASS[claim.kind] ?? 'pdtl-kind'}>{claim.kind}</span>
                        <svg className="pdtl-faq-plus" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                          <path d="M8 3.5v9M3.5 8h9" />
                        </svg>
                      </summary>
                      <div className="pdtl-faq-body">
                        {(claim.geography || claim.period || claim.kind === 'estimate' || claim.kind === 'assumption') && (
                          <div className="pdtl-claim-meta">
                            {claim.geography && <span className="pdtl-claim-geo">{claim.geography}</span>}
                            {claim.period && <span className="pdtl-claim-period">{claim.period}</span>}
                            {(claim.kind === 'estimate' || claim.kind === 'assumption') && (
                              <span className="pdtl-claim-unverified">{t('projects.notVerified')}</span>
                            )}
                          </div>
                        )}
                        {claim.value !== undefined && claim.value !== '' && (
                          <span className="pdtl-claim-value">{String(claim.value)}</span>
                        )}
                        {claim.quote && (
                          <blockquote className="pdtl-claim-quote" title={t('projects.sourceSpan')}>"{claim.quote}"</blockquote>
                        )}
                        {/* Source reference — merged in, with current status */}
                        {src && (
                          <div className="pdtl-faq-ref">
                            <span className="pdtl-faq-ref-label">{t('projects.sourcesTitle')}:</span>
                            {src.url ? (
                              <a href={src.url} className="pdtl-claim-src" target="_blank" rel="noreferrer">{src.name} ↗</a>
                            ) : (
                              <span className="pdtl-faq-ref-name">{src.name}</span>
                            )}
                            {src.accessDate && <span className="pdtl-source-date">{src.accessDate.slice(0, 10)}</span>}
                            {src.primary && <span className="pdtl-primary-tag">{t('projects.primaryTag')}</span>}
                            <span className={`pdtl-alive ${src.alive ? 'pdtl-alive--yes' : 'pdtl-alive--no'}`}>
                              {src.alive ? t('projects.aliveBadge') : t('projects.deadBadge')}
                            </span>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </Section>
          ) : product.score !== undefined ? (
            <Section title={t('projects.evidenceTitle')}>
              <p className="muted" style={{ fontSize: 13 }}>{t('projects.insufficientEvidence')}</p>
            </Section>
          ) : null}

          {/* Risk */}
          {hasRisk && (
            <Section title={t('projects.riskTitle')}>
              <div className="pdtl-risk-flags">
                {product.riskFlags!.unresolvedSafety && <span className="pdtl-risk-flag">{t('projects.riskSafety')}</span>}
                {product.riskFlags!.materialIpRisk && <span className="pdtl-risk-flag">{t('projects.riskIp')}</span>}
                {product.riskFlags!.misleadingClaimsRequired && <span className="pdtl-risk-flag">{t('projects.riskClaims')}</span>}
              </div>
              {product.riskNotes && product.riskNotes.length > 0 && (
                <ul className="pdtl-risk-notes">{product.riskNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              )}
              <p className="pdtl-risk-verify">{t('projects.riskVerify')}</p>
            </Section>
          )}

          {/* Assumptions */}
          {product.assumptions && product.assumptions.length > 0 && (
            <Section title={t('projects.assumptionsTitle')}>
              <ul className="pdtl-assumptions">
                {product.assumptions.map((a, i) => (
                  <li key={i} className="pdtl-assumption">{a}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Competition */}
          {product.competition && product.competition.competitors.length > 0 && (
            <Section title={t('projects.competitionTitle')}>
              <p className="pdtl-market">{t('projects.marketType')}: <span className="pdtl-market-pill">{product.competition.marketType}</span></p>
              <ul className="pdtl-competitors">
                {product.competition.competitors.map((c, i) => (
                  <li key={i} className="pdtl-competitor">
                    <span className="pdtl-competitor-name">{c.name}</span>
                    {c.price && <span className="pdtl-competitor-price">{c.price}</span>}
                    {c.strengths && <span className="pdtl-competitor-strengths">{c.strengths}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Customer job */}
          {product.customerJob && (product.customerJob.customer || product.customerJob.job) && (
            <Section title={t('projects.customerJobTitle')}>
              <dl className="pdtl-cj">
                {([['cjCustomer','customer'],['cjJob','job'],['cjProblem','problem'],['cjAlternative','alternative'],['cjTrigger','trigger']] as const).map(([label, key]) => product.customerJob![key] ? (<div key={key}><dt>{t(`projects.${label}`)}</dt><dd>{product.customerJob![key]}</dd></div>) : null)}
              </dl>
            </Section>
          )}

          {/* Review mining */}
          {product.reviewMining && (product.reviewMining.complaints.length > 0 || product.reviewMining.desiredFeatures.length > 0) && (
            <Section title={t('projects.reviewMiningTitle')}>
              {product.reviewMining.complaints.length > 0 && (<><p className="pdtl-sub">{t('projects.rmComplaints')}</p><ul className="pdtl-list">{product.reviewMining.complaints.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
              {product.reviewMining.desiredFeatures.length > 0 && (<><p className="pdtl-sub">{t('projects.rmFeatures')}</p><ul className="pdtl-list">{product.reviewMining.desiredFeatures.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            </Section>
          )}

          {/* Creative concepts */}
          {product.creativeConcepts && product.creativeConcepts.length > 0 && (
            <Section title={t('projects.creativeTitle')}>
              <ul className="pdtl-list">{product.creativeConcepts.map((c, i) => <li key={i}><strong>{c.hook}</strong>{c.angle ? ` — ${c.angle}` : ''}</li>)}</ul>
            </Section>
          )}

          {/* Supply chain */}
          {product.supplyChain && (product.supplyChain.suppliers.length > 0 || (product.supplyChain.notes && product.supplyChain.notes.length > 0)) && (
            <Section title={t('projects.supplyTitle')}>
              {product.supplyChain.suppliers.length > 0 && <p className="pdtl-sub">{product.supplyChain.suppliers.join(', ')}</p>}
              <p className="pdtl-meta">{product.supplyChain.moq ? `${t('projects.scMoq')}: ${product.supplyChain.moq} · ` : ''}{product.supplyChain.leadTime ? `${t('projects.scLeadTime')}: ${product.supplyChain.leadTime} · ` : ''}{product.supplyChain.certs.length ? `${t('projects.scCerts')}: ${product.supplyChain.certs.join(', ')}` : ''}</p>
              {product.supplyChain.notes && product.supplyChain.notes.length > 0 && (<ul className="pdtl-assumptions">{product.supplyChain.notes.map((n, i) => <li key={i} className="pdtl-assumption">{n}</li>)}</ul>)}
            </Section>
          )}

          {/* Validation plan */}
          {product.validationPlan && (product.validationPlan.offer || product.validationPlan.creatives.length > 0) && (
            <Section title={t('projects.validationTitle')}>
              <dl className="pdtl-cj">
                {product.validationPlan.offer && (<div><dt>{t('projects.vpOffer')}</dt><dd>{product.validationPlan.offer}</dd></div>)}
                {product.validationPlan.landingPageHypothesis && (<div><dt>{t('projects.vpLp')}</dt><dd>{product.validationPlan.landingPageHypothesis}</dd></div>)}
                {product.validationPlan.channel && (<div><dt>{t('projects.vpChannel')}</dt><dd>{product.validationPlan.channel}</dd></div>)}
                {typeof product.validationPlan.testBudget === 'number' && (<div><dt>{t('projects.vpBudget')}</dt><dd>${product.validationPlan.testBudget} <span className="pdtl-meta">{t('projects.vpBudgetNote')}</span></dd></div>)}
                {product.validationPlan.decisionRule && (<div><dt>{t('projects.vpRule')}</dt><dd>{product.validationPlan.decisionRule}</dd></div>)}
              </dl>
              {product.validationPlan.creatives.length > 0 && (<><p className="pdtl-sub">{t('projects.vpCreatives')}</p><ul className="pdtl-list">{product.validationPlan.creatives.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            </Section>
          )}

          {/* Outcome */}
          <Section title={t('projects.outcomeTitle')}>
            <textarea
              className="pdtl-outcome text-input"
              value={outcome}
              placeholder={t('projects.outcomePlaceholder')}
              rows={3}
              onChange={(e) => setOutcome(e.target.value)}
              onBlur={() => void handleOutcomeBlur()}
              disabled={savingOutcome}
            />
          </Section>
        </div>

        {/* ── Reference column — only when there's genuinely deeper content;
            otherwise the body is a single centered column (no empty aside). ───── */}
        {hasAside && (
        <div className="pd-aside">
          {/* Unit economics — the CM1 formula + sensitivity table. Headline stats
              (CM1 · break-even · max CAC · target ROAS) live in the hero, so they
              are not repeated here. */}
          {hasDeepEcon && (
            <Section title={t('projects.unitEconTitle')}>
              {product.unitEconInputs && typeof product.unitEconInputs.aov === 'number' && (
                <div className="pdtl-econ-formula">
                  <span className="pdtl-econ-formula-label">{t('projects.econFormula')}</span>
                  <p className="pdtl-econ-inputs">
                    {t('projects.aov')} ${product.unitEconInputs.aov}
                    {' − ('}
                    {t('projects.landedCost')} ${product.unitEconInputs.landedCost}
                    {' + '}{t('projects.paymentFee')} ${Math.round(product.unitEconInputs.aov * product.unitEconInputs.paymentFeePct * 100) / 100}
                    {' + '}{t('projects.fulfillment')} ${product.unitEconInputs.fulfillment}
                    {' + '}{t('projects.shippingSubsidy')} ${product.unitEconInputs.shippingSubsidy}
                    {' + '}{t('projects.returnLoss')} ${Math.round(product.unitEconInputs.aov * product.unitEconInputs.expectedReturnLossPct * 100) / 100}
                    {' + '}{t('projects.warrantyReserve')} ${Math.round(product.unitEconInputs.aov * product.unitEconInputs.warrantyReservePct * 100) / 100}
                    {') = '}{t('projects.cm1Label')}
                  </p>
                </div>
              )}
              {product.scenarios && (
                <table className="pdtl-sensitivity">
                  <thead><tr><th>{t('projects.sensitivityTitle')}</th><th>CM1</th><th>ROAS</th></tr></thead>
                  <tbody>
                    {([['scenarioBase','base'],['scenarioLow','low'],['scenarioHigh','high'],['scenarioCac','plus10Cac'],['scenarioLanded','plus10Landed'],['scenarioReturns','doubleReturns']] as const).map(([label, key]) => {
                      const sc = product.scenarios![key];
                      return (
                        <tr key={key}>
                          <td>{t(`projects.${label}`)}</td>
                          <td>{Math.round(sc.cm1Pct * 100)}%</td>
                          <td>{Number.isFinite(sc.breakEvenRoas) ? sc.breakEvenRoas.toFixed(2) + '×' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Section>
          )}

          {/* Copy-product sections — saved results, branding runs, pool research */}
          {isCopy && (
            <>
              <Section title={t('products.savedResults')}>
                {!product.results || product.results.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>—</p>
                ) : (
                  <ul className="pdtl-results-list">
                    {product.results.map((r: SavedResult) => (
                      <li key={r.id} className="pdtl-result-item">
                        {r.assetUrl && r.assetType === 'image' && (
                          <img
                            src={r.assetUrl}
                            alt=""
                            className="pdtl-result-thumb"
                          />
                        )}
                        {r.assetUrl && r.assetType === 'video' && (
                          <video
                            src={r.assetUrl}
                            className="pdtl-result-thumb"
                            muted
                            playsInline
                          />
                        )}
                        {r.output && (
                          <p className="pdtl-result-output">{r.output.slice(0, 120)}{r.output.length > 120 ? '…' : ''}</p>
                        )}
                        <button
                          type="button"
                          className="pdtl-result-remove icon-btn"
                          aria-label={t('common.close')}
                          onClick={() => void handleRemoveResult(r.id)}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={t('products.linkedRuns')}>
                {brandingRuns.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>{t('run.noRunsForPipeline')}</p>
                ) : (
                  <ul className="pdtl-runs-list">
                    {brandingRuns.map((r) => (
                      <li key={r.id} className="pdtl-run-row">
                        <span className={`badge status-${r.status}`}>{r.status}</span>
                        <span className="pdtl-run-date">{r.createdAt.slice(0, 10)}</span>
                        <span className="pdtl-run-steps">{r.steps.length} steps</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {poolProduct && (poolProduct.score !== undefined || poolProduct.decision || poolProduct.evidence.length > 0) && (
                <Section title={t('products.poolResearch')}>
                  <div className="pdtl-pool-research">
                    {poolProduct.score !== undefined && (
                      <span className="pdtl-score">{poolProduct.score}/100</span>
                    )}
                    {poolProduct.grade && (
                      <span className={`pdtl-grade ${gradeClass(poolProduct.grade)}`}>{poolProduct.grade}</span>
                    )}
                    {poolProduct.decision && (
                      <span className="pdtl-decision">{poolProduct.decision}</span>
                    )}
                    {poolProduct.evidence.length > 0 && (
                      <ul className="pdtl-evidence-list" style={{ marginTop: 8 }}>
                        {poolProduct.evidence.slice(0, 5).map((claim) => (
                          <li key={claim.id} className="pdtl-claim">
                            <div className="pdtl-claim-top">
                              <span className="pdtl-claim-stmt">{claim.statement}</span>
                              <span className={KIND_CLASS[claim.kind] ?? 'pdtl-kind'}>{claim.kind}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// ── ProductDetailPage ─────────────────────────────────────────────────────────
// Full-page route /products/:id — fetches the product by id, wires update +
// refresh, and renders the body directly (no modal). Back navigates to /products.

export function ProductDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useBreadcrumb(product?.name ?? null);

  const load = useCallback(async () => {
    if (!ws || !id) return;
    setLoading(true);
    try {
      const p = await productsApi.get(ws, id);
      setProduct(p);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [ws, id]);

  useEffect(() => { void load(); }, [load]);

  async function handleUpdate(patch: UpdateProductDto) {
    if (!ws || !id) return;
    const updated = await productsApi.update(ws, id, patch);
    setProduct(updated);
  }

  async function handleProductRefresh() {
    if (!ws || !id) return;
    const updated = await productsApi.get(ws, id);
    setProduct(updated);
  }

  const productsCrumb = { label: t('nav.products'), to: '/products' };
  const back = () => navigate('/products');

  if (loading) {
    return (
      <EditorShell crumb={productsCrumb} onClose={back} title={<h2 className="eshell-name">{t('common.loading')}</h2>}>
        <div className="pd-detail" aria-busy="true" aria-label={t('common.loading')}>
          <div className="pdtl-hero">
            <div className="pdtl-hero-media"><div className="skel pdtl-skel-media" /></div>
            <div className="pdtl-hero-info">
              <div className="skel pdtl-skel-line" style={{ width: '38%' }} />
              <div className="skel pdtl-skel-verdict" />
              <div className="skel pdtl-skel-line" style={{ width: '32%', height: 24 }} />
              <div className="skel pdtl-skel-line" style={{ width: '88%' }} />
            </div>
          </div>
        </div>
      </EditorShell>
    );
  }
  if (notFound || !product || !ws) {
    return (
      <EditorShell crumb={productsCrumb} onClose={back} title={<h2 className="eshell-name">{t('common.notFound')}</h2>}>
        <div className="pd-state center muted">{t('common.notFound')}</div>
      </EditorShell>
    );
  }

  return (
    <EditorShell
      crumb={productsCrumb}
      onClose={back}
      title={<h2 className="eshell-name">{product.name}</h2>}
      actions={
        <button
          type="button"
          className="cicon eshell-edit"
          onClick={() => navigate(`/products/${id}/edit`)}
          aria-label={t('products.edit')}
          title={t('products.edit')}
        >
          <PencilIcon width={15} height={15} />
        </button>
      }
    >
      <ProductDetailBody
        product={product}
        workspaceId={ws}
        onUpdate={handleUpdate}
        onProductRefresh={handleProductRefresh}
      />
    </EditorShell>
  );
}
