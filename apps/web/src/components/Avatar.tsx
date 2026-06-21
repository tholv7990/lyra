import { labelColor } from '@lyra/shared';
import { initials } from '../lib/format';

/**
 * Round initial-avatar with a deterministic per-name colour (solid fill, white
 * text). Replaces the card "by" avatar that was copy-pasted under five class
 * names (`mkt-by-avatar`, `pd-by-av`, `mkd-by-avatar`, `pd-meta-avatar`,
 * `tcard-avatar`) — same look, different names. Size is per-call; colour/initials
 * reuse the shared `labelColor` + `initials` helpers.
 */
export function Avatar({ name, size = 22, title }: { name?: string; size?: number; title?: string }) {
  return (
    <span
      className="avatar"
      aria-hidden
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        background: labelColor(name || 'User', []),
      }}
    >
      {initials(name)}
    </span>
  );
}
