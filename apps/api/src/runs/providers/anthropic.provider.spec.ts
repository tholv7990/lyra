import { ConfigService } from '@nestjs/config';
import { StepKey, StepMode, StepStatus, type Step } from '@lyra/shared';
import { AnthropicStepProvider } from './anthropic.provider';
import type {
  AnthropicClient,
  LlmCompletion,
  LlmCompletionParams,
} from './anthropic.client';

function step(over: Partial<Step> = {}): Step {
  return {
    index: 3,
    key: StepKey.Insight,
    mode: StepMode.Auto,
    status: StepStatus.Running,
    model: 'Claude',
    prompt: 'Identify the winning angles.',
    ...over,
  };
}

function provider(
  complete: (p: LlmCompletionParams) => Promise<LlmCompletion>,
  model?: string,
) {
  const client = { complete } as unknown as AnthropicClient;
  const config = { get: () => model } as unknown as ConfigService;
  return new AnthropicStepProvider(client, config);
}

describe('AnthropicStepProvider', () => {
  it('sends the step prompt + prior results and returns the completion', async () => {
    let captured: LlmCompletionParams | undefined;
    const p = provider(async (params) => {
      captured = params;
      return { text: 'winning angles…', usage: { tokens: 42 } };
    });

    const out = await p.execute({
      step: step(),
      apiKey: 'sk-test',
      priorResults: [
        { key: StepKey.Crawl, title: 'Crawl & extract', result: 'crawled data' },
      ],
      workspaceId: 'ws',
      ledger: { evidence: [], sources: [], data: {}, variables: {} },
    });

    expect(out.result).toBe('winning angles…');
    expect(out.usage).toEqual({ tokens: 42 });
    expect(captured?.apiKey).toBe('sk-test');
    expect(captured?.model).toBe('claude-sonnet-4-6'); // default
    expect(captured?.system).toContain('Lyra');
    expect(captured?.prompt).toContain('Identify the winning angles.');
    expect(captured?.prompt).toContain('Crawl & extract');
    expect(captured?.prompt).toContain('crawled data');
  });

  it('honors the ANTHROPIC_MODEL override', async () => {
    let captured: LlmCompletionParams | undefined;
    const p = provider(async (params) => {
      captured = params;
      return { text: 'ok' };
    }, 'claude-opus-4-8');
    await p.execute({ step: step(), apiKey: 'k', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } });
    expect(captured?.model).toBe('claude-opus-4-8');
  });

  it('throws when Claude returns an empty response', async () => {
    const p = provider(async () => ({ text: '' }));
    await expect(
      p.execute({ step: step(), apiKey: 'k', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } }),
    ).rejects.toThrow('empty');
  });
});
