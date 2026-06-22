import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrawlerCookieInfo } from '@lyra/shared';
import { connectorsApi } from '../lib/connectors';

// Workspace-level crawler cookies (cookies.txt) — used for logged-in / age-restricted
// content the user owns or has rights to. Stored encrypted server-side.
export function CrawlerCookies({ ws }: { ws: string }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<CrawlerCookieInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    connectorsApi.cookieStatus(ws).then(setInfo).catch(() => setInfo(null));
  }, [ws]);

  const upload = (file: File) => {
    setError(null);
    file
      .text()
      .then((text) => connectorsApi.setCookies(ws, text))
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : t('connectors.error')));
  };

  const remove = () => {
    connectorsApi
      .deleteCookies(ws)
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : t('connectors.error')));
  };

  return (
    <>
      <div className="cx-cookies">
        {info?.present ? (
          <span className="cx-ck-on">
            🔒 {t('connectors.cookiesActive')}
            <button type="button" className="cx-ck-remove" onClick={remove}>{t('connectors.cookiesRemove')}</button>
          </span>
        ) : (
          <label className="cx-ck-upload">
            {t('connectors.cookiesUpload')}
            <input
              type="file"
              accept=".txt"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            />
          </label>
        )}
        <span className="cx-ck-hint">{t('connectors.cookiesHint')}</span>
      </div>
      {error && <p className="cx-error">{error}</p>}
    </>
  );
}
