import { Provider, PromptType } from '@lyra/shared';

// The provider catalog the Settings page lists. A superset of the backend
// `Provider` enum: an entry is `available` (wired — `provider` is set, so it can
// hold a key and run) or `soon` (catalog-only — visible on the roadmap, not yet
// addable). Wiring a provider for real later = set `provider` + flip `status`.
export interface ProviderCatalogEntry {
  /** Stable id — equals the Provider enum value when wired, else a catalog slug. */
  id: string;
  label: string;
  /** Output modalities this provider covers — drives the modality icons. */
  modalities: PromptType[];
  status: 'available' | 'soon';
  /** Set only when wired — the enum value the keys API stores the key under. */
  provider?: Provider;
  /** Brand tint for the lettered badge shown for not-yet-wired providers. */
  color?: string;
  /** Deep-link to the provider's key console (onboarding step 1). */
  keyUrl?: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    provider: Provider.OpenAI,
    status: 'available',
    modalities: [PromptType.Text, PromptType.Image],
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    provider: Provider.Anthropic,
    status: 'available',
    modalities: [PromptType.Text],
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    provider: Provider.DeepSeek,
    status: 'available',
    modalities: [PromptType.Text],
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  // Coming soon — listed so the roadmap is visible; not addable until wired.
  {
    id: 'google',
    label: 'Google Gemini',
    status: 'soon',
    color: '#1A73E8',
    modalities: [PromptType.Text, PromptType.Image, PromptType.Audio, PromptType.Video],
  },
  { id: 'mistral', label: 'Mistral', status: 'soon', color: '#FA520F', modalities: [PromptType.Text] },
  { id: 'xai', label: 'xAI Grok', status: 'soon', color: '#111111', modalities: [PromptType.Text, PromptType.Image] },
  { id: 'groq', label: 'Groq', status: 'soon', color: '#F55036', modalities: [PromptType.Text] },
  { id: 'openrouter', label: 'OpenRouter', status: 'soon', color: '#6566F1', modalities: [PromptType.Text] },
  { id: 'perplexity', label: 'Perplexity', status: 'soon', color: '#20808D', modalities: [PromptType.Text] },
  { id: 'cohere', label: 'Cohere', status: 'soon', color: '#39594D', modalities: [PromptType.Text] },
];

export const AVAILABLE_PROVIDERS = PROVIDER_CATALOG.filter((p) => p.status === 'available');
export const SOON_PROVIDERS = PROVIDER_CATALOG.filter((p) => p.status === 'soon');

// Infer a model's output modality from its id. ponytail: id heuristic — add a
// real `modality` field to ModelOption if a provider's naming ever disagrees.
export function modelModality(id: string): PromptType {
  const s = id.toLowerCase();
  if (/image|dall-?e|flux|stable-?diffusion|\bsd(xl)?\b/.test(s)) return PromptType.Image;
  if (/audio|tts|whisper|speech|voice|sonic/.test(s)) return PromptType.Audio;
  if (/video|sora|veo|runway|kling/.test(s)) return PromptType.Video;
  return PromptType.Text;
}
