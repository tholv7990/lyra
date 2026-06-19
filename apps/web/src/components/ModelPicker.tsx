import { useRef, useState } from 'react';
import { Provider } from '@lyra/shared';
import { PROVIDER_LABELS } from '../lib/constants';
import { useOutsideClick } from '../lib/useOutsideClick';
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
        <span className="mp-model">{label}</span>
        <span className="mp-caret">⌄</span>
      </button>
      {open && (
        <div className="model-menu">
          {PROVIDERS.map((p) => (
            <div key={p} className="model-menu-group">
              <div className="mmg-label">{PROVIDER_LABELS[p]}</div>
              {(catalog[p] ?? []).map((m) => {
                const active = provider === p && model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`model-menu-item ${active ? 'active' : ''}`}
                    onClick={() => { onChange(p, m.id); setOpen(false); }}
                  >
                    <span>{m.label}</span>
                    {active && <span className="mm-check">✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
