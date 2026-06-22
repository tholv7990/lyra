import type { Competitor, MonitorAd } from '@lyra/shared';

export interface WatchlistPanelProps {
  competitors: Competitor[];
  ads: MonitorAd[];
  t: (key: string, opts?: Record<string, unknown>) => string;
  onRemove: (competitorId: string) => void;
  onOpen: (media: { url: string; type: string }) => void;
}

export function WatchlistPanel({
  competitors,
  ads,
  t,
  onRemove,
  onOpen,
}: WatchlistPanelProps) {
  if (!competitors.length) {
    return <div className="mon-empty">{t('monitor.empty')}</div>;
  }

  return (
    <div className="mon-watchlist">
      {competitors.map((comp) => {
        const compAds = ads.filter((a) => a.competitorId === comp.id);
        const activeCount = compAds.length;
        const lastError = comp.lastError && !comp.lastError.startsWith('pageId:') ? comp.lastError : null;

        return (
          <div key={comp.id} className="mon-watchlist-card">
            <div className="mon-card-head">
              <div className="mon-card-title">
                <h4 className="mon-brand">{comp.brand}</h4>
                {comp.domain && <p className="mon-domain">{comp.domain}</p>}
              </div>
              <button
                className="mon-remove-btn"
                onClick={() => onRemove(comp.id)}
                type="button"
                title={t('monitor.remove')}
                aria-label={`Remove ${comp.brand}`}
              >
                ✕
              </button>
            </div>

            <div className="mon-card-stats">
              <span className="mon-stat">
                <span className="mon-stat-value">{activeCount}</span>
                <span className="mon-stat-label">{t('monitor.statWatching')}</span>
              </span>
              {comp.lastCrawledAt && (
                <span className="mon-stat">
                  <span className="mon-stat-label">Last crawled</span>
                  <span className="mon-stat-value">{new Date(comp.lastCrawledAt).toLocaleDateString()}</span>
                </span>
              )}
            </div>

            {lastError && (
              <div className="mon-error-banner">
                <span className="mon-error-icon">⚠</span>
                <span className="mon-error-text">{lastError}</span>
              </div>
            )}

            {compAds.length > 0 && (
              <div className="mon-ads-preview">
                <p className="mon-ads-label">{t('monitor.statWatching')} ({activeCount})</p>
                <div className="mon-ads-grid">
                  {compAds.slice(0, 4).map((ad) => (
                    <div key={ad.adId} className="mon-ad-card">
                      {ad.creativeUrl && (
                        <button
                          className="mon-creative-link"
                          onClick={() => onOpen({ url: ad.creativeUrl || '', type: 'image' })}
                          type="button"
                          title={ad.copy || 'View ad'}
                        >
                          <img src={ad.creativeUrl} alt={`Ad ${ad.adId}`} />
                          <span className="mon-days-badge">{ad.daysRunning}d</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
