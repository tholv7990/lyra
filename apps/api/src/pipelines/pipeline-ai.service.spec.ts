import { Provider, StepMode } from '@lyra/shared';
import { PipelineAiService } from './pipeline-ai.service';
import type { AnthropicClient } from '../runs/providers/anthropic.client';
import type { PromptsService } from '../prompts/prompts.service';
import type { KeysService } from '../keys/keys.service';
import type { PipelinesService } from './pipelines.service';
import type { Model } from 'mongoose';
import type { Run } from '../runs/run.schema';

const PROMPT = {
  _id: { toString: () => 'p1' },
  title: 'Crawl store',
  content: 'Crawl the given store URL and extract products.',
  tags: ['source'],
  provider: Provider.Crawl,
  model: 'fetch',
};

function makeService(completionText: string, prompts: unknown[]) {
  const anthropic = {
    complete: jest.fn().mockResolvedValue({ text: completionText }),
  } as unknown as AnthropicClient;
  const promptsSvc = {
    listPublic: jest.fn().mockResolvedValue(prompts),
  } as unknown as PromptsService;
  const keys = {
    getDecrypted: jest.fn().mockResolvedValue('sk-test'),
  } as unknown as KeysService;
  const runModel = {
    aggregate: jest.fn().mockResolvedValue([]),
  } as unknown as Model<Run>;
  const pipelinesSvc = {
    findActiveById: jest.fn().mockResolvedValue(null),
  } as unknown as PipelinesService;
  return new PipelineAiService(anthropic, promptsSvc, keys, runModel, pipelinesSvc);
}

describe('PipelineAiService.generate', () => {
  it('grounds steps to real prompt ids and clamps an invalid model', async () => {
    const text = JSON.stringify({
      name: 'My pipeline',
      description: 'desc',
      steps: [
        { name: 'Crawl', promptId: 'p1', provider: 'crawl', model: 'fetch', mode: 'auto' },
        { name: 'Brand', promptId: 'p1', provider: 'openai', model: 'not-a-real-model', mode: 'gate' },
      ],
    });
    const out = await makeService(text, [PROMPT]).generate('ws', 'do a thing');

    expect(out.origin.source).toBe('ai');
    expect(out.steps).toHaveLength(2);
    expect(out.steps[0].promptId).toBe('p1');
    expect(out.steps[0].mode).toBe(StepMode.Auto);
    expect(out.steps[1].mode).toBe(StepMode.Gate);
    // the bogus model was clamped to a valid catalog entry
    expect(out.steps[1].model).not.toBe('not-a-real-model');
  });

  it('turns an unknown prompt id into a gap step', async () => {
    const text = JSON.stringify({
      name: 'P',
      description: '',
      steps: [
        {
          name: 'Mystery',
          promptId: 'does-not-exist',
          provider: 'anthropic',
          model: 'x',
          mode: 'auto',
          suggestion: 'need a brief prompt',
        },
      ],
    });
    const out = await makeService(text, [PROMPT]).generate('ws', 'goal');

    expect(out.steps[0].promptId).toBe('');
    expect(out.steps[0].suggestion).toBeTruthy();
  });

  it('parses JSON even when wrapped in a code fence + prose', async () => {
    const text = 'Here is your pipeline:\n```json\n{"name":"X","description":"","steps":[]}\n```\nEnjoy!';
    const out = await makeService(text, [PROMPT]).generate('ws', 'goal');
    expect(out.name).toBe('X');
    expect(out.steps).toEqual([]);
  });

  it('requires an Anthropic key', async () => {
    const svc = new PipelineAiService(
      { complete: jest.fn() } as unknown as AnthropicClient,
      { listPublic: jest.fn() } as unknown as PromptsService,
      { getDecrypted: jest.fn().mockResolvedValue(null) } as unknown as KeysService,
      { aggregate: jest.fn() } as unknown as Model<Run>,
      { findActiveById: jest.fn() } as unknown as PipelinesService,
    );
    await expect(svc.generate('ws', 'goal')).rejects.toThrow(/Anthropic key/i);
  });

  it('errors when the library is empty', async () => {
    await expect(makeService('{}', []).generate('ws', 'goal')).rejects.toThrow(/library is empty/i);
  });

  it('injects top-rated pipelines as few-shot examples into the system prompt', async () => {
    const anthropic = {
      complete: jest.fn().mockResolvedValue({ text: '{"name":"X","description":"","steps":[]}' }),
    } as unknown as AnthropicClient;
    const promptsSvc = {
      listPublic: jest.fn().mockResolvedValue([PROMPT]),
    } as unknown as PromptsService;
    const keys = { getDecrypted: jest.fn().mockResolvedValue('sk') } as unknown as KeysService;
    const runModel = {
      aggregate: jest.fn().mockResolvedValue([{ _id: 'pipe1' }]),
    } as unknown as Model<Run>;
    const pipelinesSvc = {
      findActiveById: jest.fn().mockResolvedValue({
        name: 'Best flow',
        description: 'great',
        origin: { goal: 'sell sofas' },
        steps: [{ name: 'Crawl', promptId: 'p1', provider: 'crawl', model: 'fetch', mode: 'auto' }],
      }),
    } as unknown as PipelinesService;
    const svc = new PipelineAiService(anthropic, promptsSvc, keys, runModel, pipelinesSvc);

    await svc.generate('ws', 'goal');

    const system = (anthropic.complete as jest.Mock).mock.calls[0][0].system as string;
    expect(system).toContain('EXAMPLES OF WELL-RATED PIPELINES');
    expect(system).toContain('sell sofas'); // the example goal
    expect(system).toContain('Crawl store'); // the prompt title resolved from the catalog
  });

  it('omits the examples section when no pipelines qualify', async () => {
    const anthropic = {
      complete: jest.fn().mockResolvedValue({ text: '{"name":"X","description":"","steps":[]}' }),
    } as unknown as AnthropicClient;
    const promptsSvc = {
      listPublic: jest.fn().mockResolvedValue([PROMPT]),
    } as unknown as PromptsService;
    const keys = { getDecrypted: jest.fn().mockResolvedValue('sk') } as unknown as KeysService;
    const runModel = { aggregate: jest.fn().mockResolvedValue([]) } as unknown as Model<Run>;
    const pipelinesSvc = {
      findActiveById: jest.fn().mockResolvedValue(null),
    } as unknown as PipelinesService;
    const svc = new PipelineAiService(anthropic, promptsSvc, keys, runModel, pipelinesSvc);

    await svc.generate('ws', 'goal');

    const system = (anthropic.complete as jest.Mock).mock.calls[0][0].system as string;
    expect(system).not.toContain('EXAMPLES OF WELL-RATED PIPELINES');
  });
});
