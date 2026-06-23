import type { Step, EvidenceClaim, SourceRow, ProductEconInputs } from '@lyra/shared';

// Read-only assembled view of everything prior steps produced + the run's inputs.
// CODE actions read it; the engine builds a fresh one before each step.
export interface RunLedger {
  evidence: EvidenceClaim[];
  sources: SourceRow[];
  data: Record<string, unknown>;
  variables: Record<string, string>;
  econInputs?: ProductEconInputs & Partial<Record<'aov' | 'landedCost' | 'paymentFeePct' | 'fulfillment' | 'shippingSubsidy' | 'expectedReturnLossPct' | 'warrantyReservePct' | 'desiredPostAdCmPct', number>>;
}

const ECON_KEYS = ['aov', 'landedCost', 'paymentFeePct', 'fulfillment', 'shippingSubsidy', 'expectedReturnLossPct', 'warrantyReservePct', 'desiredPostAdCmPct', 'targetPrice', 'testingBudget', 'inventoryBudget', 'minPreAdCmPct'] as const;

export function assembleLedger(steps: Step[], variables: Record<string, string>): RunLedger {
  const evidence: EvidenceClaim[] = [];
  const sources: SourceRow[] = [];
  const seen = new Set<string>();
  let data: Record<string, unknown> = {};
  for (const s of steps) {
    if (s.evidence) evidence.push(...s.evidence);
    for (const src of s.sources ?? []) { if (!seen.has(src.id)) { seen.add(src.id); sources.push(src); } }
    if (s.data) data = { ...data, ...s.data };
  }
  const econInputs: Record<string, number> = {};
  for (const k of ECON_KEYS) {
    const v = variables[k];
    const n = Number(v);
    if (v !== undefined && v !== '' && Number.isFinite(n)) econInputs[k] = n;
  }
  return { evidence, sources, data, variables, econInputs: Object.keys(econInputs).length ? (econInputs as RunLedger['econInputs']) : undefined };
}
