import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductStatus, Provider, StepStatus, WEIGHTS, decideWithReason, type Asset, type Product, type Run, type SavedResult, type ScoreKey, type UpdateProductDto } from '@lyra/shared';
import { api } from '../lib/api';
import { productsApi, productResultsApi } from '../lib/products';
import { productRunsApi } from '../lib/productRuns';
import { useRunActions } from '../lib/useRunActions';
import { Modal } from './Modal';
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

// ── Shared props ────────────────────────────────────────────────────────────

interface Props {
  product: Product;
  workspaceId: string;
  onClose: () => void;
  onUpdate: (patch: UpdateProductDto) => Promise<void>;
  onProductRefresh: () => Promise<void>;
}

// ── ProductDetailBody ───────────────────────────────────────────────────────
// Presentational body — no portal/hooks that require a DOM. Exported so tests
// can render it with renderToStaticMarkup; ProductDetail wraps it in <Modal>.

export function ProductDetailBody({ product, workspaceId, onClose, onUpdate, onProductRefresh }: Props) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState(product.outcome ?? '');
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [runAssets, setRunAssets] = useState<Asset[]>([]);

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
            {decisionReason && (
              <span className="pdtl-decision-reason" title={t('projects.decisionReason', { reason: decisionReason })}>
                {t('projects.decisionReason', { reason: decisionReason })}
              </span>
            )}
            {/* Status picker */}
            <MenuPicker<ProductStatus>
              value={product.status}
              options={statusOptions}
              onChange={handleStatusChange}
              ariaLabel={t('projects.statusAria')}
            />
            {/* Run research — only for pool products (not copies) */}
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

        {displayError && <p className="error">{displayError}</p>}

        {/* Score breakdown — explains the /100 with real per-factor numbers */}
        {factorRows.length > 0 ? (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.scoreBreakdownTitle')}</h3>
            <ul className="pdtl-factors">
              {factorRows.map((f) => (
                <li key={f.key} className="pdtl-factor">
                  <span className="pdtl-factor-name">{t(`projects.factorLabels.${f.key}`)}</span>
                  <span className="pdtl-factor-sub">{f.sub}/5</span>
                  <span className="pdtl-factor-bar" aria-hidden="true">
                    <span className="pdtl-factor-fill" style={{ width: `${(f.contribution / f.weight) * 100}%` }} />
                  </span>
                  <span className="pdtl-factor-pts">{f.contribution}/{f.weight}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : product.score === undefined ? (
          <p className="muted" style={{ fontSize: 13 }}>{t('projects.notScored')}</p>
        ) : null}

        {product.riskFlags && (product.riskFlags.unresolvedSafety || product.riskFlags.materialIpRisk || product.riskFlags.misleadingClaimsRequired) && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.riskTitle')}</h3>
            <div className="pdtl-risk-flags">
              {product.riskFlags.unresolvedSafety && <span className="pdtl-risk-flag">{t('projects.riskSafety')}</span>}
              {product.riskFlags.materialIpRisk && <span className="pdtl-risk-flag">{t('projects.riskIp')}</span>}
              {product.riskFlags.misleadingClaimsRequired && <span className="pdtl-risk-flag">{t('projects.riskClaims')}</span>}
            </div>
            {product.riskNotes && product.riskNotes.length > 0 && (
              <ul className="pdtl-risk-notes">{product.riskNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            )}
            <p className="pdtl-risk-verify">{t('projects.riskVerify')}</p>
          </section>
        )}

        {product.assumptions && product.assumptions.length > 0 && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.assumptionsTitle')}</h3>
            <ul className="pdtl-assumptions">
              {product.assumptions.map((a, i) => (
                <li key={i} className="pdtl-assumption">{a}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Run timeline — shown once a research run has been started */}
        {run && run.steps.length > 0 && (
          <section className="pdtl-section">
            <RunTimeline
              run={run}
              busy={isBusy}
              hasKey={() => true}
              onRunStep={runStep}
              onApprove={(i) => {
                approve(i);
                // After approval, trigger a product refresh so research fields update
                // if this was the save gate (run status will reach done shortly).
                void onProductRefresh();
              }}
              onSavePrompt={savePrompt}
              onRegenerate={regenerate}
              assets={runAssets}
              historyForStep={historyForStep}
            />
            {/* Save-to-product actions for done steps */}
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
          </section>
        )}

        {/* Run-all shortcut when run is present but steps haven't started yet */}
        {run && run.steps.length > 0 && run.steps.every((s) => s.status === StepStatus.Idle) && (
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

        {/* ── Copy-product sections ───────────────────────────────────── */}
        {isCopy && (
          <>
            {/* Linked branding runs */}
            <section className="pdtl-section">
              <h3 className="pdtl-section-label">{t('products.linkedRuns')}</h3>
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
            </section>

            {/* Saved results gallery */}
            <section className="pdtl-section">
              <h3 className="pdtl-section-label">{t('products.savedResults')}</h3>
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
                        className="pdtl-result-remove mkd-close"
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
            </section>

            {/* Pool research read-only */}
            {poolProduct && (poolProduct.score !== undefined || poolProduct.decision || poolProduct.evidence.length > 0) && (
              <section className="pdtl-section">
                <h3 className="pdtl-section-label">{t('products.poolResearch')}</h3>
                <div className="pdtl-pool-research">
                  {poolProduct.score !== undefined && (
                    <span className="pdtl-score">{poolProduct.score}/100</span>
                  )}
                  {poolProduct.grade && (
                    <span className="pdtl-grade">{poolProduct.grade}</span>
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
              </section>
            )}
          </>
        )}

        {/* Evidence claims */}
        {product.evidence.length > 0 ? (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.evidenceTitle')}</h3>
            <ul className="pdtl-evidence-list">
              {product.evidence.map((claim) => {
                const src = product.sources.find((s) => s.id === claim.sourceId);
                return (
                  <li key={claim.id} className="pdtl-claim">
                    <div className="pdtl-claim-top">
                      <span className="pdtl-claim-stmt">{claim.statement}</span>
                      <span className={KIND_CLASS[claim.kind] ?? 'pdtl-kind'}>{claim.kind}</span>
                      {(claim.kind === 'estimate' || claim.kind === 'assumption') && (
                        <span className="pdtl-claim-unverified">{t('projects.notVerified')}</span>
                      )}
                    </div>
                    <div className="pdtl-claim-meta">
                      {claim.geography && <span className="pdtl-claim-geo">{claim.geography}</span>}
                      {claim.period && <span className="pdtl-claim-period">{claim.period}</span>}
                      {src?.url && (
                        <a href={src.url} className="pdtl-claim-src" target="_blank" rel="noreferrer">{src.name}</a>
                      )}
                    </div>
                    {claim.value !== undefined && claim.value !== '' && (
                      <span className="pdtl-claim-value">{String(claim.value)}</span>
                    )}
                    {claim.quote && (
                      <blockquote className="pdtl-claim-quote" title={t('projects.sourceSpan')}>"{claim.quote}"</blockquote>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : product.score !== undefined ? (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.evidenceTitle')}</h3>
            <p className="muted" style={{ fontSize: 13 }}>{t('projects.insufficientEvidence')}</p>
          </section>
        ) : null}

        {product.competition && product.competition.competitors.length > 0 && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.competitionTitle')}</h3>
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
          </section>
        )}

        {product.customerJob && (product.customerJob.customer || product.customerJob.job) && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.customerJobTitle')}</h3>
            <dl className="pdtl-cj">
              {([['cjCustomer','customer'],['cjJob','job'],['cjProblem','problem'],['cjAlternative','alternative'],['cjTrigger','trigger']] as const).map(([label, key]) => product.customerJob![key] ? (<div key={key}><dt>{t(`projects.${label}`)}</dt><dd>{product.customerJob![key]}</dd></div>) : null)}
            </dl>
          </section>
        )}
        {product.reviewMining && (product.reviewMining.complaints.length > 0 || product.reviewMining.desiredFeatures.length > 0) && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.reviewMiningTitle')}</h3>
            {product.reviewMining.complaints.length > 0 && (<><p className="pdtl-sub">{t('projects.rmComplaints')}</p><ul className="pdtl-list">{product.reviewMining.complaints.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            {product.reviewMining.desiredFeatures.length > 0 && (<><p className="pdtl-sub">{t('projects.rmFeatures')}</p><ul className="pdtl-list">{product.reviewMining.desiredFeatures.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
          </section>
        )}
        {product.creativeConcepts && product.creativeConcepts.length > 0 && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.creativeTitle')}</h3>
            <ul className="pdtl-list">{product.creativeConcepts.map((c, i) => <li key={i}><strong>{c.hook}</strong>{c.angle ? ` — ${c.angle}` : ''}</li>)}</ul>
          </section>
        )}
        {product.supplyChain && (product.supplyChain.suppliers.length > 0 || (product.supplyChain.notes && product.supplyChain.notes.length > 0)) && (
          <section className="pdtl-section">
            <h3 className="pdtl-section-label">{t('projects.supplyTitle')}</h3>
            {product.supplyChain.suppliers.length > 0 && <p className="pdtl-sub">{product.supplyChain.suppliers.join(', ')}</p>}
            <p className="pdtl-meta">{product.supplyChain.moq ? `${t('projects.scMoq')}: ${product.supplyChain.moq} · ` : ''}{product.supplyChain.leadTime ? `${t('projects.scLeadTime')}: ${product.supplyChain.leadTime} · ` : ''}{product.supplyChain.certs.length ? `${t('projects.scCerts')}: ${product.supplyChain.certs.join(', ')}` : ''}</p>
            {product.supplyChain.notes && product.supplyChain.notes.length > 0 && (<ul className="pdtl-assumptions">{product.supplyChain.notes.map((n, i) => <li key={i} className="pdtl-assumption">{n}</li>)}</ul>)}
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
