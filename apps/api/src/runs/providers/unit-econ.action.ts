import { BadRequestException, Injectable } from '@nestjs/common';
import { computeUnitEcon, type UnitEconInputs } from '@lyra/shared';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const REQUIRED: (keyof UnitEconInputs)[] = ['aov', 'landedCost', 'paymentFeePct', 'fulfillment', 'shippingSubsidy', 'expectedReturnLossPct', 'warrantyReservePct', 'desiredPostAdCmPct'];

@Injectable()
export class UnitEconAction implements ActionProvider {
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const e = ctx.ledger.econInputs;
    if (!e || REQUIRED.some((k) => typeof (e as Record<string, unknown>)[k] !== 'number')) {
      throw new BadRequestException('Unit economics needs cost inputs (aov, landedCost, …) — set them on the run.');
    }
    const unitEcon = computeUnitEcon(e as UnitEconInputs);
    const result = `# Unit economics\nCM1 ${unitEcon.cm1.toFixed(2)} (${(unitEcon.cm1Pct * 100).toFixed(1)}%) · break-even ROAS ${unitEcon.breakEvenRoas.toFixed(2)} · max CAC ${unitEcon.maxCac.toFixed(2)} · target ROAS ${unitEcon.targetRoas.toFixed(2)}`;
    return { result, data: { unitEcon }, usage: { tokens: 0 } };
  }
}
