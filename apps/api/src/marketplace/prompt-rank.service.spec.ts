import { PromptRankService } from './prompt-rank.service';
import type { AnthropicClient } from '../runs/providers/anthropic.client';
import type { KeysService } from '../keys/keys.service';
import type { Model } from 'mongoose';
import type { MarketplacePrompt } from './marketplace.schema';

const DOCS = [
  {
    _id: { toString: () => 'm1' },
    title: 'Linux Terminal',
    content: 'Act as a linux terminal.',
    type: 'structured',
    forDevs: true,
    source: 'prompts.chat',
    variables: [],
    tags: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    _id: { toString: () => 'm2' },
    title: 'Travel Guide',
    content: 'Act as a travel guide.',
    type: 'text',
    forDevs: false,
    source: 'prompts.chat',
    variables: [],
    tags: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

// Mock the chained .find().sort().limit().exec().
function modelReturning(docs: unknown[]): Model<MarketplacePrompt> {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(docs),
  };
  return { find: jest.fn().mockReturnValue(chain) } as unknown as Model<MarketplacePrompt>;
}

function makeService(opts: {
  completionText: string;
  docs?: unknown[];
  key?: string | null;
}): { svc: PromptRankService; anthropic: AnthropicClient } {
  const anthropic = {
    complete: jest.fn().mockResolvedValue({ text: opts.completionText }),
  } as unknown as AnthropicClient;
  const keys = {
    getDecrypted: jest.fn().mockResolvedValue(opts.key === undefined ? 'sk-test' : opts.key),
  } as unknown as KeysService;
  const model = modelReturning(opts.docs ?? DOCS);
  return { svc: new PromptRankService(anthropic, keys, model), anthropic };
}

describe('PromptRankService.rank', () => {
  it('joins ranked ids back to full prompts, sorts by score desc, clamps score', async () => {
    const text = JSON.stringify([
      { id: 'm2', score: 40, reason: 'somewhat' },
      { id: 'm1', score: 150, reason: 'great fit' }, // score clamped to 100
    ]);
    const { svc } = makeService({ completionText: text });
    const out = await svc.rank('ws', 'linux help', 5);

    expect(out).toHaveLength(2);
    expect(out[0].prompt.id).toBe('m1');
    expect(out[0].score).toBe(100);
    expect(out[0].reason).toBe('great fit');
    expect(out[1].prompt.id).toBe('m2');
    // joined to the full safe shape
    expect(out[0].prompt.title).toBe('Linux Terminal');
    expect(out[0].prompt.forDevs).toBe(true);
  });

  it('drops entries whose id is not in the catalog', async () => {
    const text = JSON.stringify([
      { id: 'ghost', score: 90, reason: 'nope' },
      { id: 'm1', score: 80, reason: 'yes' },
    ]);
    const { svc } = makeService({ completionText: text });
    const out = await svc.rank('ws', 'need', 5);
    expect(out.map((r) => r.prompt.id)).toEqual(['m1']);
  });

  it('parses a JSON array wrapped in a code fence + prose', async () => {
    const text = 'Here you go:\n```json\n[{"id":"m1","score":70,"reason":"ok"}]\n```\nDone!';
    const { svc } = makeService({ completionText: text });
    const out = await svc.rank('ws', 'need', 5);
    expect(out).toHaveLength(1);
    expect(out[0].prompt.id).toBe('m1');
  });

  it('returns [] on malformed model output', async () => {
    const { svc } = makeService({ completionText: 'not json at all' });
    expect(await svc.rank('ws', 'need', 5)).toEqual([]);
  });

  it('caps results to the requested limit', async () => {
    const text = JSON.stringify([
      { id: 'm1', score: 90, reason: 'a' },
      { id: 'm2', score: 80, reason: 'b' },
    ]);
    const { svc } = makeService({ completionText: text });
    const out = await svc.rank('ws', 'need', 1);
    expect(out).toHaveLength(1);
    expect(out[0].prompt.id).toBe('m1');
  });

  it('requires an Anthropic key', async () => {
    const { svc } = makeService({ completionText: '[]', key: null });
    await expect(svc.rank('ws', 'need', 5)).rejects.toThrow(/Anthropic key/i);
  });

  it('returns [] for an empty query without calling the model', async () => {
    const { svc, anthropic } = makeService({ completionText: '[]' });
    expect(await svc.rank('ws', '   ', 5)).toEqual([]);
    expect((anthropic.complete as jest.Mock)).not.toHaveBeenCalled();
  });
});
