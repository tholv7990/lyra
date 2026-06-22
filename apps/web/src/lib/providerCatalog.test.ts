import { describe, it, expect } from 'vitest';
import { PromptType, Provider } from '@lyra/shared';
import { modelModality, AVAILABLE_PROVIDERS } from './providerCatalog';

describe('providerCatalog', () => {
  it('lists Google Gemini as an addable provider wired to Provider.Google', () => {
    const google = AVAILABLE_PROVIDERS.find((p) => p.id === 'google');
    expect(google).toBeTruthy();
    expect(google?.provider).toBe(Provider.Google);
    expect(google?.status).toBe('available');
  });

  // I3: Google must be Image-only so it is excluded from Chats (spec §11.3 scoped
  // Chats out for Google; callModel falls through to a silent mock for non-Anthropic).
  it('Google Gemini modalities are Image-only (not Text/Audio/Video)', () => {
    const google = AVAILABLE_PROVIDERS.find((p) => p.id === 'google');
    expect(google?.modalities).toEqual([PromptType.Image]);
    expect(google?.modalities).not.toContain(PromptType.Text);
    expect(google?.modalities).not.toContain(PromptType.Audio);
    expect(google?.modalities).not.toContain(PromptType.Video);
  });

  it('lists Replicate as an addable key stored under Provider.Video', () => {
    const r = AVAILABLE_PROVIDERS.find((p) => p.id === 'replicate');
    expect(r).toBeTruthy();
    expect(r?.provider).toBe(Provider.Video);
    expect(r?.status).toBe('available');
  });
});

describe('modelModality', () => {
  it('classifies model ids by output modality', () => {
    expect(modelModality('gpt-image-1')).toBe(PromptType.Image);
    expect(modelModality('dall-e-3')).toBe(PromptType.Image);
    expect(modelModality('flux-pro')).toBe(PromptType.Image);
    expect(modelModality('whisper-1')).toBe(PromptType.Audio);
    expect(modelModality('tts-1-hd')).toBe(PromptType.Audio);
    expect(modelModality('sora-2')).toBe(PromptType.Video);
    expect(modelModality('veo-3')).toBe(PromptType.Video);
    // default: anything without a media marker reads as text
    expect(modelModality('gpt-5.5-pro')).toBe(PromptType.Text);
    expect(modelModality('claude-opus-4-8')).toBe(PromptType.Text);
    expect(modelModality('deepseek-reasoner')).toBe(PromptType.Text);
  });
});
