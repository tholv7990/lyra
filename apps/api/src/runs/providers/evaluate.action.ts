import { BadRequestException, Injectable } from '@nestjs/common';
import { weightedScore, gradeConfidence, decide, type SubScores, type HardGates, type EvidenceClaim, type UnitEcon, type RiskFlags } from '@lyra/shared';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

@Injectable()
export class EvaluateAction implements ActionProvider {
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const data = ctx.ledger.data as { subScores?: SubScores; unitEcon?: UnitEcon; riskFlags?: RiskFlags };
    if (!data.subScores) throw new BadRequestException('Evaluate needs sub-scores — an upstream scoring step must run first.');
    const evidence = ctx.ledger.evidence as EvidenceClaim[];
    const unitEcon = data.unitEcon;
    const distinctSources = new Set(evidence.filter((c) => c.sourceId).map((c) => c.sourceId)).size;
    const risk = (ctx.ledger.data as { riskFlags?: RiskFlags }).riskFlags;
    const gates: HardGates = {
      unresolvedSafety: !!risk?.unresolvedSafety,
      materialIpRisk: !!risk?.materialIpRisk,
      misleadingClaimsRequired: !!risk?.misleadingClaimsRequired,
      negativeUnitEcon: !!unitEcon && unitEcon.cm1 <= 0,
      cpaExceedsMaxCac: !!unitEcon && unitEcon.maxCac <= 0,
      singleSourceDemand: distinctSources <= 1,
    };
    const score = weightedScore(data.subScores);
    const grade = gradeConfidence(evidence);
    const decision = decide(score, gates, data.subScores);
    const result = `# Evaluation\nScore ${score.toFixed(0)}/100 · grade ${grade} · decision ${decision}`;
    return { result, data: { score, grade, decision, subScores: data.subScores, hardGates: gates }, usage: { tokens: 0 } };
  }
}
