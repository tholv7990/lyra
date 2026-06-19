import { ProjectStatus, Provider, type PromptStatus } from '@lyra/shared';

// Shared display maps that were redefined per-page. Provider display names and
// the Draft/Public status hue belong in one place so every surface matches.

export const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
  [Provider.Crawl]: 'Crawl',
};

// PromptStatus and ProjectStatus share the same 'draft'/'public' values, so one
// map serves both (keyed via ProjectStatus members).
export const STATUS_COLOR: Record<PromptStatus | ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'var(--warning)',
  [ProjectStatus.Public]: 'var(--success)',
};
