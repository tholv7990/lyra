import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { CompetitorStatus, MonitorPlatform, AdStatus } from '@lyra/shared';

function svc(over: Record<string, any> = {}) {
  const competitors = { find: jest.fn(), findById: jest.fn(), create: jest.fn(), ...over.competitors };
  const handles = { create: jest.fn(), ...over.handles };
  const ads = { ...over.ads };
  const events = { ...over.events };
  const proxy = { usesService: () => true, forward: jest.fn(), ...over.proxy };
  const creds = { getDecrypted: jest.fn().mockResolvedValue('apify-key'), ...over.creds };
  return {
    s: new MonitorService(
      competitors as never,
      handles as never,
      ads as never,
      events as never,
      proxy as never,
      creds as never,
    ),
    competitors,
    handles,
    ads,
    events,
    proxy,
    creds,
  };
}

describe('MonitorService.discover', () => {
  it('dedupes candidates against existing brands and upserts the rest', async () => {
    const { s, competitors, proxy } = svc({
      competitors: {
        find: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve([
              { brand: 'Brand A', workspaceId: 'ws1' },
            ]),
        }),
        create: jest.fn().mockImplementation((d) =>
          Promise.resolve({ ...d, _id: { toString: () => 'c1' } }),
        ),
      },
    });
    proxy.forward.mockResolvedValue({
      advertisers: [
        { pageId: 'P1', pageName: 'Brand A', domain: 'a.com' }, // existing → skip
        { pageId: 'P2', pageName: 'Brand B', domain: 'b.com' }, // new → create
      ],
    });
    const out = await s.discover('ws1', 'u1', ['cozy sofa']);
    expect(proxy.forward).toHaveBeenCalledWith('ws1', 'u1', 'POST', 'adlibrary/search', { keywords: ['cozy sofa'] }, 'apify-key');
    expect(competitors.create).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
  });

  it('throws BadRequestException when proxy.usesService() && no key', async () => {
    const { s } = svc({
      creds: { getDecrypted: jest.fn().mockResolvedValue(null) },
      proxy: { usesService: () => true, forward: jest.fn() },
    });
    const err = await s.discover('ws1', 'u1', ['test']).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toContain('Add an Apify key in Connections to use the monitor.');
  });

  it('proceeds with mock data when proxy.usesService() is false and no key', async () => {
    const { s, proxy } = svc({
      competitors: {
        find: jest.fn().mockReturnValue({
          exec: () => Promise.resolve([]),
        }),
        create: jest.fn().mockImplementation((d) =>
          Promise.resolve({ ...d, _id: { toString: () => 'c1' } }),
        ),
      },
      proxy: { usesService: () => false, forward: jest.fn() },
      creds: { getDecrypted: jest.fn().mockResolvedValue(null) },
    });
    proxy.forward.mockResolvedValue({
      advertisers: [{ pageId: 'P1', pageName: 'Brand C', domain: 'c.com' }],
    });
    const out = await s.discover('ws1', 'u1', ['test']);
    expect(out).toHaveLength(1);
  });
});

describe('MonitorService.approve', () => {
  it('resolves the Meta handle from stashed pageId and sets status to watching', async () => {
    const { s, handles } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve({
              _id: 'c1',
              workspaceId: 'ws1',
              brand: 'Test Brand',
              status: CompetitorStatus.Candidate,
              lastError: 'pageId:P123',
              save: jest.fn().mockResolvedValue(undefined),
            }),
        }),
      },
    });
    const result = await s.approve('ws1', 'c1');
    expect(handles.create).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      competitorId: 'c1',
      platform: MonitorPlatform.Meta,
      advertiserId: 'P123',
      resolvedAt: expect.any(Date),
    });
    expect(result.status).toBe(CompetitorStatus.Watching);
    expect(result.lastError).toBeUndefined();
  });

  it('throws NotFoundException when competitor not found', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({
          exec: () => Promise.resolve(null),
        }),
      },
    });
    const err = await s.approve('ws1', 'invalid-id').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when competitor belongs to a different workspace', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve({
              _id: 'c1',
              workspaceId: 'ws2',
              status: CompetitorStatus.Candidate,
            }),
        }),
      },
    });
    const err = await s.approve('ws1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
  });
});

describe('MonitorService.reject', () => {
  it('sets status to archived', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve({
              _id: 'c1',
              workspaceId: 'ws1',
              status: CompetitorStatus.Candidate,
              save: jest.fn().mockResolvedValue(undefined),
            }),
        }),
      },
    });
    const result = await s.reject('ws1', 'c1');
    expect(result.status).toBe(CompetitorStatus.Archived);
  });

  it('throws NotFoundException when competitor not found', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({
          exec: () => Promise.resolve(null),
        }),
      },
    });
    const err = await s.reject('ws1', 'invalid-id').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when competitor belongs to a different workspace', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve({
              _id: 'c1',
              workspaceId: 'ws2',
              status: CompetitorStatus.Candidate,
            }),
        }),
      },
    });
    const err = await s.reject('ws1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
  });
});

describe('MonitorService.list', () => {
  it('lists all competitors for a workspace without status filter', async () => {
    const { s, competitors } = svc({
      competitors: {
        find: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve([
              { _id: 'c1', brand: 'Brand A', status: CompetitorStatus.Candidate },
              { _id: 'c2', brand: 'Brand B', status: CompetitorStatus.Watching },
            ]),
        }),
      },
    });
    const result = await s.list('ws1');
    expect(competitors.find).toHaveBeenCalledWith({ workspaceId: 'ws1' });
    expect(result).toHaveLength(2);
  });

  it('lists competitors filtered by status', async () => {
    const { s, competitors } = svc({
      competitors: {
        find: jest.fn().mockReturnValue({
          exec: () =>
            Promise.resolve([
              { _id: 'c1', brand: 'Brand A', status: CompetitorStatus.Watching },
            ]),
        }),
      },
    });
    const result = await s.list('ws1', CompetitorStatus.Watching);
    expect(competitors.find).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      status: CompetitorStatus.Watching,
    });
    expect(result).toHaveLength(1);
  });
});

describe('MonitorService.runDailyForCompetitor', () => {
  it('inserts new ads, bumps ongoing, stops missing, writes events', async () => {
    const today = MonitorService.today();
    const ads = {
      find: jest.fn().mockReturnValue({ exec: () => Promise.resolve([
        { adId: 'b', daysRunning: 2, status: AdStatus.Active, save: jest.fn() },     // ongoing
        { adId: 'd', daysRunning: 5, status: AdStatus.Active, save: jest.fn() },     // stopped
      ]) }),
      create: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const handles = { find: jest.fn().mockReturnValue({ exec: () => Promise.resolve([{ advertiserId: 'PAGE1', platform: 'meta' }]) }) };
    const events = { create: jest.fn().mockResolvedValue({}) };
    const proxy = { usesService: () => true, forward: jest.fn().mockResolvedValue({ ads: [
      { adId: 'a', creativeUrl: 'u', copy: 'c', format: 'image' }, { adId: 'b' },
    ] }) };
    const creds = { getDecrypted: jest.fn().mockResolvedValue('k') };
    const competitors = {};
    const s = new MonitorService(competitors as never, handles as never, ads as never, events as never, proxy as never, creds as never);
    await s.runDailyForCompetitor('ws1', { _id: { toString: () => 'c1' }, brand: 'B', save: jest.fn() } as never);
    expect(ads.create).toHaveBeenCalledTimes(1); // 'a' is new
    expect(events.create).toHaveBeenCalledWith(expect.objectContaining({ adId: 'a', event: 'new', date: today }));
    expect(events.create).toHaveBeenCalledWith(expect.objectContaining({ adId: 'd', event: 'stopped', date: today }));
  });
});

describe('MonitorService.changelog', () => {
  it('groups events by day → competitor with joined new/stopped ad detail (desc by date)', async () => {
    const events = { find: jest.fn().mockReturnValue({ exec: () => Promise.resolve([
      { competitorId: 'c1', adId: 'a', event: 'new', date: '2026-06-22' },
      { competitorId: 'c1', adId: 'b', event: 'stopped', date: '2026-06-22' },
      { competitorId: 'c2', adId: 'x', event: 'new', date: '2026-06-21' },
    ]) }) };
    const competitors = {
      find: jest.fn().mockReturnValue({ exec: () => Promise.resolve([
        { _id: 'c1', brand: 'Brand A' }, { _id: 'c2', brand: 'Brand B' },
      ]) }),
      countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(2) }),
    };
    const ads = { find: jest.fn().mockReturnValue({ exec: () => Promise.resolve([
      { competitorId: 'c1', adId: 'a', creativeUrl: 'ua', daysRunning: 1 },
      { competitorId: 'c1', adId: 'b', creativeUrl: 'ub', daysRunning: 4 },
      { competitorId: 'c2', adId: 'x', creativeUrl: 'ux', daysRunning: 1 },
    ]) }) };
    const s = new MonitorService(
      competitors as never, {} as never, ads as never, events as never,
      { usesService: () => false } as never, {} as never,
    );
    const out = await s.changelog('ws1', 7);
    expect(out.stats.watching).toBe(2);
    expect(out.byDay.map((d) => d.date)).toEqual(['2026-06-22', '2026-06-21']); // newest first
    const top = out.byDay[0].competitors[0];
    expect(top.brand).toBe('Brand A');
    expect(top.newAds.map((a) => a.adId)).toEqual(['a']);
    expect(top.stopped.map((a) => a.adId)).toEqual(['b']);
    expect(out.byDay[1].competitors[0].brand).toBe('Brand B');
    expect(out.byDay[1].competitors[0].newAds.map((a) => a.adId)).toEqual(['x']);
  });
});

describe('MonitorService.remove', () => {
  it('deletes the competitor and cascades handles/ads/events', async () => {
    const { s, competitors, handles, ads, events } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({ exec: () => Promise.resolve({ _id: 'c1', workspaceId: 'ws1' }) }),
        deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
      },
      handles: { deleteMany: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }) },
      ads: { deleteMany: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }) },
      events: { deleteMany: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }) },
    });
    await s.remove('ws1', 'c1');
    expect(competitors.deleteOne).toHaveBeenCalledWith({ _id: 'c1' });
    expect(handles.deleteMany).toHaveBeenCalledWith({ workspaceId: 'ws1', competitorId: 'c1' });
    expect(ads.deleteMany).toHaveBeenCalledWith({ workspaceId: 'ws1', competitorId: 'c1' });
    expect(events.deleteMany).toHaveBeenCalledWith({ workspaceId: 'ws1', competitorId: 'c1' });
  });

  it('throws NotFoundException for a competitor in another workspace', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({ exec: () => Promise.resolve({ _id: 'c1', workspaceId: 'ws2' }) }),
      },
    });
    const err = await s.remove('ws1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toContain('competitor not found');
  });

  it('throws NotFoundException for a non-existent competitor', async () => {
    const { s } = svc({
      competitors: {
        findById: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
      },
    });
    const err = await s.remove('ws1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
  });
});

describe('MonitorService.adsForCompetitor', () => {
  it('queries active ads for the workspace+competitor, sorted by daysRunning desc', async () => {
    const sortExec = { sort: jest.fn().mockReturnValue({ exec: () => Promise.resolve([
      { adId: 'a', daysRunning: 5, status: AdStatus.Active },
      { adId: 'b', daysRunning: 2, status: AdStatus.Active },
    ]) }) };
    const { s, ads } = svc({ ads: { find: jest.fn().mockReturnValue(sortExec) } });
    const out = await s.adsForCompetitor('ws1', 'c1');
    expect(ads.find).toHaveBeenCalledWith({ workspaceId: 'ws1', competitorId: 'c1', status: AdStatus.Active });
    expect(out).toHaveLength(2);
    expect(out[0].adId).toBe('a');
  });
});
