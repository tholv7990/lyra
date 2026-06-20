import { ProviderIcon } from './ProviderIcon';
import type { ProviderCatalogEntry } from '../lib/providerCatalog';

// Brand badge for any catalog provider: the real logomark when the provider is
// wired (ProviderIcon), otherwise a neutral lettered tile in the brand tint —
// so coming-soon providers still read as a brand, not a gap.
export function ProviderBadge({ entry, size = 22 }: { entry: ProviderCatalogEntry; size?: number }) {
  if (entry.provider) return <ProviderIcon provider={entry.provider} size={size} />;
  return (
    <span
      className="prov-badge-soon"
      aria-hidden="true"
      style={{ width: size, height: size, background: entry.color ?? 'var(--ink-tertiary)', fontSize: size * 0.5 }}
    >
      {entry.label.charAt(0)}
    </span>
  );
}
