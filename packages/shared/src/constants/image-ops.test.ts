import { describe, it, expect } from 'vitest';
import { ImageOp } from '../enums';
import { IMAGE_OP_PRESETS, imageOpPrompt } from './image-ops';

describe('image-ops', () => {
  it('has a preset for every ImageOp', () => {
    for (const op of Object.values(ImageOp)) {
      expect(IMAGE_OP_PRESETS[op]).toBeDefined();
      expect(IMAGE_OP_PRESETS[op].label.length).toBeGreaterThan(0);
      expect(IMAGE_OP_PRESETS[op].instruction.length).toBeGreaterThan(0);
    }
  });

  it('imageOpPrompt returns the op instruction', () => {
    expect(imageOpPrompt(ImageOp.Upscale)).toBe(IMAGE_OP_PRESETS[ImageOp.Upscale].instruction);
    expect(imageOpPrompt(ImageOp.Variation)).toContain('variation');
  });

  it('instructions are distinct per op', () => {
    const set = new Set(Object.values(ImageOp).map(imageOpPrompt));
    expect(set.size).toBe(Object.values(ImageOp).length);
  });
});
