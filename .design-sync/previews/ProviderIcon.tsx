import { ProviderIcon } from '@lyra/web';

// provider is the shared Provider enum (string values); pass the literals so the
// preview needs no cross-package import.
export function Providers() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <ProviderIcon provider={'anthropic' as never} size={28} />
      <ProviderIcon provider={'openai' as never} size={28} />
      <ProviderIcon provider={'deepseek' as never} size={28} />
      <ProviderIcon provider={'google' as never} size={28} />
      <ProviderIcon provider={'image' as never} size={28} />
      <ProviderIcon provider={'video' as never} size={28} />
    </div>
  );
}
