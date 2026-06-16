import {
  curateAnthropic,
  curateDeepSeek,
  curateOpenAi,
} from './model-curation';

describe('model curation', () => {
  it('curateAnthropic keeps the latest model per tier, in tier order', () => {
    const out = curateAnthropic([
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-3-7-sonnet-20250219', label: 'Claude Sonnet 3.7' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5' },
    ]);
    expect(out.map((m) => m.id)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('curateAnthropic ignores models with no recognizable tier', () => {
    const out = curateAnthropic([{ id: 'claude-instant-1', label: 'Instant' }]);
    expect(out).toEqual([]);
  });

  it('curateOpenAi keeps the newest GPT family + newest reasoning model only', () => {
    const out = curateOpenAi([
      'gpt-3.5-turbo',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-5',
      'gpt-5-pro',
      'gpt-5.5',
      'gpt-5.5-pro',
      'gpt-5.5-2026-04-23', // dated snapshot -> dropped
      'gpt-5.5-codex', // specialized -> dropped
      'gpt-5.5-chat-latest', // alias -> dropped
      'o1',
      'o3',
      'o3-mini',
      'o4-mini',
      'text-embedding-3', // not a chat model -> dropped
      'dall-e-3', // not a chat model -> dropped
    ]);
    expect(out.map((m) => m.id)).toEqual(['gpt-5.5', 'gpt-5.5-pro', 'o4-mini']);
  });

  it('curateOpenAi keeps mini/nano variants of the newest family', () => {
    const out = curateOpenAi(['gpt-6', 'gpt-6-mini', 'gpt-6-nano', 'gpt-5.5']);
    expect(out.map((m) => m.id)).toEqual(['gpt-6', 'gpt-6-mini', 'gpt-6-nano']);
  });

  it('curateDeepSeek drops dated snapshots, sorts, dedupes', () => {
    const out = curateDeepSeek([
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'deepseek-v4-pro', // dup
      'deepseek-chat-2026-01-01', // dated -> dropped
    ]);
    expect(out.map((m) => m.id)).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']);
  });
});
