import { describe, expect, test } from 'vitest';
import { PromptStatus, PromptType, Provider } from '@lyra/shared';
import { buildPromptQuery } from './Prompts';

describe('buildPromptQuery', () => {
  test('serializes multi-select status, tags, createdBy, provider and type filters', () => {
    const query = buildPromptQuery({
      page: 2,
      limit: 15,
      statuses: [PromptStatus.Public, PromptStatus.Draft],
      tags: ['seo', 'competitor'],
      createdBy: ['user-1', 'user-2'],
      providers: [Provider.Anthropic, Provider.DeepSeek],
      types: [PromptType.Text, PromptType.Image],
      q: 'cozy',
      sort: 'updated',
    });

    expect(query).toBe(
      'page=2&limit=15&status=public&status=draft&tag=seo&tag=competitor&createdBy=user-1&createdBy=user-2&provider=anthropic&provider=deepseek&type=text&type=image&q=cozy&sort=updated',
    );
  });

  test('encodes the type filter as repeated params, matching tag/status', () => {
    const query = buildPromptQuery({
      page: 1,
      limit: 15,
      statuses: [],
      tags: [],
      createdBy: [],
      providers: [],
      types: [PromptType.Image, PromptType.Video],
      q: '',
      sort: 'az',
    });

    expect(query).toBe('page=1&limit=15&type=image&type=video&sort=az');
  });
});
