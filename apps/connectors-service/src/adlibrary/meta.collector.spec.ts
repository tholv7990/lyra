import { MetaCollector } from './meta.collector';

const apify = { runActor: jest.fn() };
const collector = () => new MetaCollector(apify as never);

describe('MetaCollector', () => {
  beforeEach(() => apify.runActor.mockReset());

  it('crawlAds normalizes actor rows to {adId, creativeUrl, copy, format}', async () => {
    apify.runActor.mockResolvedValue([
      { adArchiveID: '111', snapshot: { videos: [{ video_hd_url: 'https://cdn/v.mp4' }], body: { text: 'Hook A' } } },
      { adArchiveID: '222', snapshot: { images: [{ original_image_url: 'https://cdn/i.jpg' }], body: { text: 'Hook B' } } },
    ]);
    const out = await collector().crawlAds('PAGE1', 'tok');
    expect(out).toEqual([
      { adId: '111', creativeUrl: 'https://cdn/v.mp4', copy: 'Hook A', format: 'video' },
      { adId: '222', creativeUrl: 'https://cdn/i.jpg', copy: 'Hook B', format: 'image' },
    ]);
  });

  it('crawlAds drops rows with no ad id', async () => {
    apify.runActor.mockResolvedValue([{ snapshot: {} }, { adArchiveID: '333', snapshot: {} }]);
    const out = await collector().crawlAds('PAGE1', 'tok');
    expect(out.map((a) => a.adId)).toEqual(['333']);
  });

  it('searchAdvertisers dedupes by pageId and keeps name+domain', async () => {
    apify.runActor.mockResolvedValue([
      { pageID: 'P1', pageName: 'Brand A', snapshot: { link_url: 'https://a.com/x' } },
      { pageID: 'P1', pageName: 'Brand A', snapshot: {} },
      { pageID: 'P2', pageName: 'Brand B', snapshot: { link_url: 'https://b.com' } },
    ]);
    const out = await collector().searchAdvertisers(['cozy sofa'], 'tok');
    expect(out).toEqual([
      { pageId: 'P1', pageName: 'Brand A', domain: 'a.com' },
      { pageId: 'P2', pageName: 'Brand B', domain: 'b.com' },
    ]);
  });
});
