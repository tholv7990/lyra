import { stepCacheKey } from './step-cache.schema';

describe('stepCacheKey', () => {
  const base = { workspaceId: 'ws1', provider: 'anthropic', model: 'claude-opus-4-8', prompt: 'hello' };
  it('is a stable 64-char sha256 hex for identical input', () => {
    const a = stepCacheKey(base);
    const b = stepCacheKey({ ...base });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it('changes when ANY field changes', () => {
    const k = stepCacheKey(base);
    expect(stepCacheKey({ ...base, workspaceId: 'ws2' })).not.toBe(k);
    expect(stepCacheKey({ ...base, provider: 'openai' })).not.toBe(k);
    expect(stepCacheKey({ ...base, model: 'gpt-5.5' })).not.toBe(k);
    expect(stepCacheKey({ ...base, prompt: 'hello!' })).not.toBe(k);
  });
  it('does not collide across field boundaries', () => {
    // 'a|b' vs 'ab|'-style ambiguity guard
    expect(stepCacheKey({ ...base, provider: 'a', model: 'bc' })).not.toBe(
      stepCacheKey({ ...base, provider: 'ab', model: 'c' }),
    );
  });
});
