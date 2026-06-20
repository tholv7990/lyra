import type { ComponentType, SVGProps } from 'react';
import { PromptType } from '@lyra/shared';
import {
  AudioTypeIcon,
  ImageTypeIcon,
  TextTypeIcon,
  VideoTypeIcon,
} from '../layout/icons';

// Distinct, token-based hue per output type — drives the filter dot, the editor's
// colored type icons, and any other type affordance. Single source of truth so
// the literal token map is never duplicated across pages.
export const TYPE_COLOR: Record<PromptType, string> = {
  [PromptType.Text]: 'var(--accent-prompts)',
  [PromptType.Image]: 'var(--accent-projects)',
  [PromptType.Audio]: 'var(--accent-keys)',
  [PromptType.Video]: 'var(--accent-chats)',
};

// Glyph per output type (hand-authored, currentColor — tint with TYPE_COLOR).
export const TYPE_ICON: Record<PromptType, ComponentType<SVGProps<SVGSVGElement>>> = {
  [PromptType.Text]: TextTypeIcon,
  [PromptType.Image]: ImageTypeIcon,
  [PromptType.Audio]: AudioTypeIcon,
  [PromptType.Video]: VideoTypeIcon,
};

// A single modality glyph, tinted by its type — the content-true marker used on
// provider cards and per-model tags. `title` makes it a labelled image for SR.
export function ModalityIcon({ type, size = 13, title }: { type: PromptType; size?: number; title?: string }) {
  const Icon = TYPE_ICON[type];
  return (
    <Icon
      width={size}
      height={size}
      style={{ color: TYPE_COLOR[type] }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
