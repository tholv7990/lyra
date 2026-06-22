import { Provider } from '../enums';

// Curated model catalog per provider — the single source of truth for the model
// dropdowns in prompt testing and pipeline steps. Anthropic ids are real; the
// other providers are placeholders until their phases (they run via MockStepProvider).
export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_CATALOG: Record<Provider, ModelOption[]> = {
  [Provider.Anthropic]: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  [Provider.OpenAI]: [
    { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
    { id: 'gpt-5.5', label: 'GPT-5.5' },
  ],
  [Provider.DeepSeek]: [
    // Self-hosted open models served via Ollama behind the LiteLLM gateway
    // ($0/token). See docs/lyra-litellm-gateway.md.
    { id: 'deepseek-v3-local', label: 'DeepSeek V3 (local)' },
    { id: 'llama-3.3-local', label: 'Llama 3.3 (local)' },
    // DeepSeek's hosted API (used when the gateway forwards to api.deepseek.com).
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  ],
  [Provider.Image]: [
    { id: 'gpt-image-1', label: 'GPT Image 1' },
    { id: 'dall-e-3', label: 'DALL·E 3' },
  ],
  [Provider.Video]: [
    { id: 'minimax/video-01', label: 'MiniMax Hailuo (video-01)' },
    { id: 'kwaivgi/kling-v1.6-standard', label: 'Kling v1.6 Standard' },
    { id: 'luma/ray', label: 'Luma Ray' },
  ],
  // Crawl has no model — it fetches a URL. A placeholder keeps the step's
  // required model non-empty.
  [Provider.Crawl]: [{ id: 'fetch', label: 'Fetch page' }],
  [Provider.Google]: [{ id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' }],
};

export function isModelAllowed(provider: Provider, model: string): boolean {
  return (MODEL_CATALOG[provider] ?? []).some((m) => m.id === model);
}

export function defaultModel(provider: Provider): string {
  return MODEL_CATALOG[provider]?.[0]?.id ?? '';
}

// Distinguishes a real provider model id (lowercase, hyphenated — e.g.
// "claude-opus-4-8", "gpt-5.5-pro", "deepseek-chat") from a fixed-step display
// label (Title Case / spaces — e.g. "Claude", "GPT-5.5 Pro"). Used so steps that
// carry a live, refreshed model id pass it straight through, while legacy fixed
// steps fall back to the provider default. We no longer gate on the static
// catalog — models are refreshed from the provider's live API.
export function looksLikeModelId(model: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*$/.test(model.trim());
}
