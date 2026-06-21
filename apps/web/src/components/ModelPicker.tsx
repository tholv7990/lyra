import { useRef, useState } from 'react';
import { Provider } from '@lyra/shared';
import { PROVIDER_LABELS } from '../lib/constants';
import { useOutsideClick } from '../lib/useOutsideClick';
import { ProviderIcon } from './ProviderIcon';
import type { ModelCatalog } from '../lib/useModels';

const PROVIDERS = Object.values(Provider);

// Compact provider·model pill + dropdown (matches the testing chat). The menu
// opens upward (it lives in a bottom bar). Shared by the playground & editor.
export function ModelPicker({
  catalog,
  provider,
  model,
  onChange,
}: {
  catalog: ModelCatalog;
  provider: Provider;
  model: string;
  onChange: (provider: Provider, model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, open, () => setOpen(false));

  const label = catalog[provider]?.find((m) => m.id === model)?.label ?? model;

  return (
    <div className="model-pick" ref={ref}>
      <button type="button" className="model-pill" onClick={() => setOpen((s) => !s)}>
        <ProviderIcon provider={provider} size={15} className="mp-icon" />
        <span className="mp-model">{label}</span>
        <span className="mp-caret">⌄</span>
      </button>
      {open && (
        <div className="model-menu">
          {PROVIDERS.map((p) => {
            const models = catalog[p] ?? [];
            if (models.length === 0) return null;
            return (
              <div key={p} className="model-menu-group">
                <div className="mmg-label">{PROVIDER_LABELS[p]}</div>
                {models.map((m) => {
                  const active = provider === p && model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`model-menu-item ${active ? 'active' : ''}`}
                      onClick={() => { onChange(p, m.id); setOpen(false); }}
                    >
                      <span className="mm-left">
                        <ProviderIcon provider={p} size={16} className="mm-icon" />
                        <span className="mm-name">{m.label}</span>
                      </span>
                      {active && <span className="mm-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
