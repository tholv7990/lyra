import { describe, it, expect } from 'vitest';
import { PromptType } from '@lyra/shared';
import { modelModality } from './providerCatalog';

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
