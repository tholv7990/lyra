import { describe, expect, test } from 'vitest';
import { PromptStatus, Provider } from '@lyra/shared';
import { buildPromptQuery } from './Prompts';

describe('buildPromptQuery', () => {
  test('serializes multi-select status, tags, and createdBy filters', () => {
    const query = buildPromptQuery({
      page: 2,
      limit: 15,
      statuses: [PromptStatus.Public, PromptStatus.Draft],
      tags: ['seo', 'competitor'],
      createdBy: ['user-1', 'user-2'],
      providers: [Provider.Anthropic, Provider.DeepSeek],
      q: 'cozy',
    });

    expect(query).toBe(
      'page=2&limit=15&status=public&status=draft&tag=seo&tag=competitor&createdBy=user-1&createdBy=user-2&provider=anthropic&provider=deepseek&q=cozy',
    );
  });
});
