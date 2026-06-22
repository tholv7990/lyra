import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { ChangelogFeed } from './ChangelogFeed';

const t = (k: string, o?: Record<string, unknown>) => (o?.days ? `${k}:${o.days}` : k);

describe('ChangelogFeed', () => {
  it('renders NEW/ONGOING/STOPPED rows per competitor', () => {
    const html = renderToStaticMarkup(
      <ChangelogFeed
        t={t}
        byDay={[
          {
            date: '2026-06-22',
            competitors: [
              {
                competitorId: 'c1',
                brand: 'Brand A',
                newAds: [
                  {
                    adId: 'a',
                    status: 'active',
                    firstSeen: '2026-06-22',
                    lastSeen: '2026-06-22',
                    daysRunning: 1,
                  } as never,
                ],
                ongoing: [{ adId: 'b', daysRunning: 4 } as never],
                stopped: [],
              },
            ],
          },
        ]}
        onOpen={() => {}}
      />
    );
    expect(html).toContain('Brand A');
    expect(html).toContain('monitor.badgeNew');
    expect(html).toContain('monitor.badgeOngoing:4');
  });

  it('shows the empty state with no events', () => {
    expect(
      renderToStaticMarkup(<ChangelogFeed t={t} byDay={[]} onOpen={() => {}} />)
    ).toContain('monitor.empty');
  });
});
