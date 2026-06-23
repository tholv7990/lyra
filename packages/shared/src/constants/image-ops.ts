import { ImageOp } from '../enums';

// Preset instruction prompts for image actions. The instruction is sent to the
// Google/Gemini image provider WITH the source image as an input — Gemini edits
// from the reference. These are prompt-driven approximations, not dedicated
// upscale/outpaint algorithms (Gemini exposes no such params).
// ponytail: operations are prompt presets; if Gemini later exposes real
// upscale/outpaint params, branch the provider then.
export const IMAGE_OP_PRESETS: Record<ImageOp, { label: string; instruction: string }> = {
  [ImageOp.Upscale]: {
    label: 'Upscale',
    instruction:
      'Recreate this exact image at higher fidelity: sharper detail, cleaner edges, ' +
      'richer texture, higher perceived resolution. Keep the subject, composition, ' +
      'framing, colors, and any branding identical — do not restyle or move anything. ' +
      'Output a single image.',
  },
  [ImageOp.Variation]: {
    label: 'Variation',
    instruction:
      'Create a fresh variation of this image: keep the same subject, product, and ' +
      'overall style, but change the composition, angle, and arrangement for a ' +
      'distinctly different shot. Preserve product accuracy and branding. ' +
      'Output a single image.',
  },
  [ImageOp.Outpaint]: {
    label: 'Outpaint',
    instruction:
      'Extend this image outward beyond its current borders, continuing the scene ' +
      'naturally on all sides (wider framing, more background). Keep the existing ' +
      'subject, lighting, colors, and branding consistent with the original. ' +
      'Output a single image.',
  },
};

// The instruction prompt for an image operation.
export function imageOpPrompt(op: ImageOp): string {
  return IMAGE_OP_PRESETS[op].instruction;
}
