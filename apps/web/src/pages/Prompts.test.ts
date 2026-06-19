import { describe, expect, test } from 'vitest';
import { PromptCategory, PromptStatus, PromptType, Provider } from '@lyra/shared';
import { buildPromptQuery } from './Prompts';

describe('buildPromptQuery', () => {
  test('serializes multi-select status, tags, createdBy, provider, type and category filters', () => {
    const query = buildPromptQuery({
      page: 2,
      limit: 15,
      statuses: [PromptStatus.Public, PromptStatus.Draft],
      tags: ['seo', 'competitor'],
      createdBy: ['user-1', 'user-2'],
      providers: [Provider.Anthropic, Provider.DeepSeek],
      types: [PromptType.Text, PromptType.Image],
      categories: [PromptCategory.Coding, PromptCategory.Writing],
      q: 'cozy',
    });

    expect(query).toBe(
      'page=2&limit=15&status=public&status=draft&tag=seo&tag=competitor&createdBy=user-1&createdBy=user-2&provider=anthropic&provider=deepseek&type=text&type=image&category=Coding&category=Writing&q=cozy',
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
      categories: [],
      q: '',
    });

    expect(query).toBe('page=1&limit=15&type=image&type=video');
  });

  test('encodes the category filter as repeated params, matching type — values are proper nouns', () => {
    const query = buildPromptQuery({
      page: 1,
      limit: 15,
      statuses: [],
      tags: [],
      createdBy: [],
      providers: [],
      types: [],
      categories: [PromptCategory.Business, PromptCategory.BusinessStrategy],
      q: '',
    });

    expect(query).toBe('page=1&limit=15&category=Business&category=Business+Strategy');
  });
});
