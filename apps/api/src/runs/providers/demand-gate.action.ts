import { BadRequestException, Injectable } from '@nestjs/common';
import { demandSignalCount, type EvidenceClaim } from '@lyra/shared';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const MIN_SIGNALS = 3;

@Injectable()
export class DemandGateAction implements ActionProvider {
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const n = demandSignalCount(ctx.ledger.evidence as EvidenceClaim[]);
    if (n < MIN_SIGNALS) {
      throw new BadRequestException(`Only ${n} independent demand signal(s) — needs ≥${MIN_SIGNALS} before deeper research.`);
    }
    return { result: `# Demand gate\n${n} independent demand signals — passes (≥${MIN_SIGNALS}).`, data: { demandSignals: n }, usage: { tokens: 0 } };
  }
}
