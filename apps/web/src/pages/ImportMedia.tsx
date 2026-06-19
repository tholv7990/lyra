import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { downloadFile } from '../lib/api';
import { RefreshIcon } from '../layout/icons';
import './connectors.css';

const TYPE_GLYPH: Record<MediaItem['type'], string> = { video: '▶', image: '🖼', audio: '♪' };

export interface FetchButtonStateInput {
  hasWorkspace: boolean;
  workspaceLoading: boolean;
  url: string;
  busy: boolean;
}

export function fetchButtonState(input: FetchButtonStateInput) {
  const waiting = input.busy || input.workspaceLoading;
  return {
    disabled: waiting || !input.hasWorkspace || !input.url.trim(),
    labelKey: waiting ? 'loading' : 'fetch',
    spin: waiting,
    ...(input.workspaceLoading
      ? { statusKey: 'preparingWorkspace' }
      : input.busy
        ? { statusKey: 'resolvingMedia' }
        : {}),
  } as const;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Built-ins → Import media. Paste a social link → Cobalt (via the proxy) resolves
// it → preview the items → download. Mock-backed until the microservice exists.
export function ImportMedia() {
  const { t } = useTranslation();
  const { current, loading: workspaceLoading } = useWorkspace();
  const ws = current?.id;

  const [url, setUrl] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [fetched, setFetched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = fetchButtonState({
    hasWorkspace: Boolean(ws),
    workspaceLoading,
    url,
    busy,
  });

  const fetchMedia = () => {
    if (fetchState.disabled || !ws) return;
    setBusy(true);
    setError(null);
    connectorsApi
      .resolve(ws, url.trim())
      .then((r) => { setItems(r.items); setFetched(true); })
      .catch((err) => setError(err instanceof Error ? err.message : t('connectors.error')))
      .finally(() => setBusy(false));
  };

  const download = (indices?: number[]) => {
    if (!ws) return;
    void connectorsApi
      .download(ws, url.trim(), indices)
      .then((r) =>
        r.items.forEach((it) =>
          it.url.startsWith('http')
            ? triggerDownload(it.url, it.filename)        // absolute (mock/external)
            : void downloadFile(it.url, it.filename),     // proxied Lyra file (authed)
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : t('connectors.error')));
  };

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.importTitle')}</h2>
      <p className="cx-sub">{t('connectors.importSubtitle')}</p>

      <div className="cx-bar">
        <input
          className="cx-url"
          placeholder={t('connectors.urlPlaceholder')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') fetchMedia(); }}
        />
        <button
          className="cx-btn-primary cx-fetch-btn"
          disabled={fetchState.disabled}
          aria-busy={fetchState.spin}
          onClick={fetchMedia}
        >
          {fetchState.spin && <RefreshIcon className="cx-spin" />}
          {t(`connectors.${fetchState.labelKey}`)}
        </button>
      </div>
      {fetchState.statusKey && <p className="cx-status">{t(`connectors.${fetchState.statusKey}`)}</p>}
      <div className="cx-plats">{t('connectors.supported')}</div>
      {error && <p className="cx-error">{error}</p>}

      {items.length > 0 && (
        <div className="cx-section">
          <div className="cx-sec-head">
            <span className="cx-sec-title">{t('connectors.resolved', { count: items.length })}</span>
          </div>
          <div className="cx-mgrid">
            {items.map((it) => (
              <div className="cx-tile" key={it.index}>
                <span className="cx-tbadge">{it.type.toUpperCase()}</span>
                <div className="cx-mthumb">{it.thumbUrl ? <img src={it.thumbUrl} alt="" /> : TYPE_GLYPH[it.type]}</div>
                <div className="cx-tfoot">
                  <span>{it.filename ?? `item-${it.index}`}</span>
                  <button className="cx-tdl" title={t('connectors.download')} onClick={() => download([it.index])}>↓</button>
                </div>
              </div>
            ))}
          </div>
          <div className="cx-foot">
            <span className="cx-gate">⚠️ {t('connectors.tosNote')}</span>
            <button className="cx-btn" onClick={() => download()}>{t('connectors.downloadAll')}</button>
          </div>
        </div>
      )}

      {fetched && items.length === 0 && <p className="cx-empty">{t('connectors.nothingResolved')}</p>}
    </div>
  );
}
