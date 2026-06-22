import type { CompetitorChangelog, MonitorAd } from '@lyra/shared';

export interface ChangelogFeedProps {
  byDay: { date: string; competitors: CompetitorChangelog[] }[];
  t: (key: string, opts?: Record<string, unknown>) => string;
  onOpen: (media: { url: string; type: string }) => void;
}

interface AdRowProps {
  ad: MonitorAd;
  badgeKey: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onOpen: (media: { url: string; type: string }) => void;
}

function AdRow({ ad, badgeKey, t, onOpen }: AdRowProps) {
  const handleClick = () => {
    if (ad.creativeUrl) {
      onOpen({ url: ad.creativeUrl, type: 'image' });
    }
  };

  return (
    <div className="mon-ad-row">
      {ad.creativeUrl && (
        <button
          className="mon-creative-thumb"
          onClick={handleClick}
          type="button"
          aria-label={`Ad ${ad.adId}`}
        >
          <img src={ad.creativeUrl} alt={`Ad ${ad.adId}`} />
        </button>
      )}
      <div className="mon-ad-info">
        <p className="mon-ad-copy">{ad.copy || 'No copy available'}</p>
        <span className="mon-badge">{t(badgeKey, { days: ad.daysRunning })}</span>
      </div>
    </div>
  );
}

export function ChangelogFeed({ byDay, t, onOpen }: ChangelogFeedProps) {
  if (!byDay.length) {
    return <div className="mon-empty">{t('monitor.empty')}</div>;
  }

  return (
    <div className="mon-changelog">
      {byDay.map((day) => (
        <div key={day.date} className="mon-day">
          <h3 className="mon-date">{day.date}</h3>
          {day.competitors.map((comp) => (
            <div key={comp.competitorId} className="mon-competitor">
              <h4 className="mon-brand">{comp.brand}</h4>

              {comp.newAds.length > 0 && (
                <div className="mon-ads-group">
                  <span className="mon-group-label">{t('monitor.badgeNew')}</span>
                  {comp.newAds.map((ad) => (
                    <AdRow
                      key={ad.adId}
                      ad={ad}
                      badgeKey="monitor.badgeNew"
                      t={t}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )}

              {comp.ongoing.length > 0 && (
                <div className="mon-ads-group">
                  <span className="mon-group-label">{t('monitor.badgeOngoing', { days: comp.ongoing[0]?.daysRunning || 0 })}</span>
                  {comp.ongoing.map((ad) => (
                    <AdRow
                      key={ad.adId}
                      ad={ad}
                      badgeKey="monitor.badgeOngoing"
                      t={t}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )}

              {comp.stopped.length > 0 && (
                <div className="mon-ads-group">
                  <span className="mon-group-label">{t('monitor.badgeStopped')}</span>
                  {comp.stopped.map((ad) => (
                    <AdRow
                      key={ad.adId}
                      ad={ad}
                      badgeKey="monitor.badgeStopped"
                      t={t}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
