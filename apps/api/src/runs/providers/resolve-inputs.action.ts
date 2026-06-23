import { Injectable } from '@nestjs/common';
import { resolveInputs, type EconRaw } from '@lyra/shared';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

// CODE step: fill conservative defaults for any missing economic input and emit an
// explicit assumptions[] (§1A). Downstream unit-econ uses resolvedEconInputs.
@Injectable()
export class ResolveInputsAction implements ActionProvider {
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const { inputs, assumptions } = resolveInputs((ctx.ledger.econInputs ?? {}) as EconRaw);
    const result = assumptions.length
      ? `# Resolved inputs\n${assumptions.length} assumption(s):\n${assumptions.map((a) => `- ${a}`).join('\n')}`
      : '# Resolved inputs\nAll economic inputs provided — no assumptions.';
    return { result, data: { resolvedEconInputs: inputs, assumptions }, usage: { tokens: 0 } };
  }
}
