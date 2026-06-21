// Social-platform glyph + brand colour for channel chips/icons. One source of truth
// for the Publish composer, the project editor's channel picker, and the project hub.
const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏',
};
const COLOR: Record<string, string> = {
  tiktok: '#111827', instagram: '#e1306c', youtube: '#ff0000', facebook: '#1877f2', x: '#111827',
};

const LABEL: Record<string, string> = {
  tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', x: 'X',
};

export const platformGlyph = (platform: string): string => GLYPH[platform] ?? '◆';
export const platformColor = (platform: string): string => COLOR[platform] ?? 'var(--ink-tertiary)';
export const platformLabel = (platform: string): string => LABEL[platform] ?? platform;

// The platforms a channel can target (also the PlatformSelect's default options).
export const PLATFORMS = ['tiktok', 'youtube', 'instagram', 'facebook', 'x'] as const;
