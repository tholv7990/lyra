import { Injectable } from '@nestjs/common';
import type { EvidenceClaim, SourceRow, UnitEcon, SubScores, ConfidenceGrade, Decision } from '@lyra/shared';
import { ProductsService } from '../../products/products.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

@Injectable()
export class SaveProductAction implements ActionProvider {
  constructor(private readonly products: ProductsService) {}

  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const d = ctx.ledger.data as { unitEcon?: UnitEcon; subScores?: SubScores; score?: number; grade?: ConfidenceGrade; decision?: Decision };
    const name = (ctx.action as { productName?: string }).productName || ctx.ledger.variables.note || 'Researched product';

    if (!ctx.projectId) {
      return { result: '[save] no project on this run (builder test run) — not persisted.', data: {}, usage: { tokens: 0 } };
    }

    const productId = await this.products.saveResearch(ctx.projectId, ctx.workspaceId, 'system', {
      name,
      evidence: ctx.ledger.evidence as EvidenceClaim[],
      sources: ctx.ledger.sources as SourceRow[],
      unitEcon: d.unitEcon,
      subScores: d.subScores,
      score: d.score,
      grade: d.grade,
      decision: d.decision,
    });

    return {
      result: `# Saved product\n${name} → ${productId} (${d.decision ?? 'no decision'})`,
      data: { productId },
      usage: { tokens: 0 },
    };
  }
}
