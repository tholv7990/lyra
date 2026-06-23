import { ResearchTemplateService } from './research-template.service';

function make(existing: any[] = []) {
  const pipelines = {
    listForWorkspace: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockImplementation(async (p: any) => ({ _id: 'pl1', ...p })),
    normalizeSteps: (s: any[]) => s,
    normalizeVariables: (v: any[]) => v,
    toView: jest.fn().mockImplementation(async (p: any) => ({ id: 'pl1', name: p.name, steps: p.steps })),
  };
  const prompts = { create: jest.fn().mockResolvedValue({ id: 'pr1' }) };
  return { svc: new ResearchTemplateService(pipelines as never, prompts as never), pipelines, prompts };
}

describe('ResearchTemplateService.seed', () => {
  it('creates the prompt + a 6-step pipeline marked origin.research-template', async () => {
    const { svc, pipelines, prompts } = make();
    const out = await svc.seed('ws', 'user1');
    expect(prompts.create).toHaveBeenCalled();
    const created = pipelines.create.mock.calls[0][0];
    expect(created.origin.source).toBe('research-template');
    expect(created.steps).toHaveLength(6);
    expect(created.steps[5].mode).toBe('gate');
    expect(out.id).toBe('pl1');
  });

  it('is idempotent — returns the existing template, no duplicate', async () => {
    const { svc, pipelines, prompts } = make([{ origin: { source: 'research-template' } }]);
    await svc.seed('ws', 'user1');
    expect(pipelines.create).not.toHaveBeenCalled();
    expect(prompts.create).not.toHaveBeenCalled();
  });
});
