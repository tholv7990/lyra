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
    if (!ctx.productId) {
      return { result: '[save] no product on this run — not persisted (builder/test run).', data: {}, usage: { tokens: 0 } };
    }
    await this.products.applyResearch(ctx.productId, 'system', {
      evidence: ctx.ledger.evidence as EvidenceClaim[],
      sources: ctx.ledger.sources as SourceRow[],
      unitEcon: d.unitEcon, subScores: d.subScores, score: d.score, grade: d.grade, decision: d.decision,
    });
    return { result: `# Research saved to product\n${ctx.productId} (${d.decision ?? 'no decision'})`, data: { productId: ctx.productId }, usage: { tokens: 0 } };
  }
}
