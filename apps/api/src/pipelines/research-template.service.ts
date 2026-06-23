import { Injectable } from '@nestjs/common';
import {
  ActionType,
  Provider,
  PromptStatus,
  PromptType,
  StepMode,
  type Pipeline as PipelineView,
} from '@lyra/shared';
import { PipelinesService } from './pipelines.service';
import type { PipelineDocument } from './pipeline.schema';
import { PromptsService } from '../prompts/prompts.service';

const TEMPLATE_NAME = 'Product research';
const RESEARCH_QUESTION =
  'Find and validate a winning dropshipping product in the {niche} niche for {product}. ' +
  'Gather demand evidence — search-interest trends (5yr/12mo/90d), marketplace/sales signals, ' +
  'geography — and tie every claim to a source.';

@Injectable()
export class ResearchTemplateService {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly prompts: PromptsService,
  ) {}

  async seed(workspaceId: string, actorId: string): Promise<PipelineView> {
    // Idempotency: return existing template without creating a duplicate.
    const existing = (await this.pipelines.listForWorkspace(workspaceId)).find(
      (p) => (p as unknown as { origin?: { source?: string } }).origin?.source === 'research-template',
    );

    const act = (
      type: ActionType,
      name: string,
      mode: StepMode = StepMode.Auto,
      extra: Record<string, unknown> = {},
    ) => ({
      name,
      promptId: '',
      provider: Provider.Research,
      model: 'auto',
      mode,
      kind: 'action',
      action: { type, ...extra },
    });

    const buildSteps = (pid: string) => this.pipelines.normalizeSteps([
      act(ActionType.ResolveInputs, 'Resolve inputs'),
      { name: 'Research', promptId: pid, provider: Provider.Research, model: 'auto', mode: StepMode.Auto },
      act(ActionType.DemandGate, 'Demand gate'),
      act(ActionType.Competition, 'Competition'),
      act(ActionType.Score, 'Score'),
      act(ActionType.UnitEcon, 'Unit economics'),
      act(ActionType.Evaluate, 'Evaluate'),
      act(ActionType.SaveProduct, 'Save & review', StepMode.Gate),
    ] as never);

    if (existing) {
      const hasCompetition = (existing.steps ?? []).some(
        (s) => (s as { action?: { type?: string } }).action?.type === ActionType.Competition,
      );
      if (!hasCompetition) {
        const research = (existing.steps ?? []).find((s) => (s as { promptId?: string }).promptId);
        const pid = (research as { promptId?: string } | undefined)?.promptId ?? '';
        existing.steps = buildSteps(pid) as never;
        await existing.save();
      }
      return this.pipelines.toView(existing);
    }

    // Create the library prompt that the Research step is bound to.
    // PromptsService.create() comes from BaseRepository — it takes Partial<Prompt>
    // and returns HydratedDocument<Prompt>. The schema field is `title` (not `name`).
    const promptDoc = await this.prompts.create({
      workspaceId,
      title: TEMPLATE_NAME,
      content: RESEARCH_QUESTION,
      provider: Provider.Research,
      model: 'auto',
      type: PromptType.Text,
      status: PromptStatus.Public,
      createdBy: actorId,
      updatedBy: actorId,
      tags: ['research'],
    } as never);

    // Support both the real HydratedDocument (_id) and the test mock ({ id }).
    const promptId: string =
      (promptDoc as unknown as { id?: string }).id ??
      (promptDoc as unknown as { _id: { toString(): string } })._id.toString();

    const steps = buildSteps(promptId);

    const variables = this.pipelines.normalizeVariables([
      { key: 'niche', label: 'Niche', default: '' },
      { key: 'product', label: 'Product', default: '' },
      { key: 'aov', label: 'AOV (selling price)', default: '40' },
      { key: 'landedCost', label: 'Landed cost', default: '10' },
      { key: 'paymentFeePct', label: 'Payment fee %', default: '0.03' },
      { key: 'fulfillment', label: 'Fulfillment', default: '5' },
      { key: 'shippingSubsidy', label: 'Shipping subsidy', default: '2' },
      { key: 'expectedReturnLossPct', label: 'Return loss %', default: '0.05' },
      { key: 'warrantyReservePct', label: 'Warranty reserve %', default: '0' },
      { key: 'desiredPostAdCmPct', label: 'Desired post-ad CM %', default: '0.15' },
    ] as never);

    const created = await this.pipelines.create({
      workspaceId,
      createdBy: actorId,
      updatedBy: actorId,
      name: TEMPLATE_NAME,
      description: 'Grounded product-research pipeline (v1).',
      tags: ['research'],
      steps,
      variables,
      origin: { source: 'research-template' },
    } as never);

    return this.pipelines.toView(created);
  }

  async seedDoc(workspaceId: string, actorId: string): Promise<PipelineDocument> {
    await this.seed(workspaceId, actorId); // ensure it exists (idempotent)
    const existing = (await this.pipelines.listForWorkspace(workspaceId)).find(
      (p) => (p as unknown as { origin?: { source?: string } }).origin?.source === 'research-template',
    );
    if (!existing) throw new Error('research template missing after seed');
    return existing;
  }
}
