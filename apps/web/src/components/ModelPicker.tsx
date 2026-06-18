import { useEffect, useRef, useState } from 'react';
import { Provider } from '@lyra/shared';
import type { ModelCatalog } from '../lib/useModels';

const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
  [Provider.Crawl]: 'Crawl',
};
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

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
