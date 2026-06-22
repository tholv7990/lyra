import { gatherInputImages, fetchImageAsBase64 } from './image-inputs';

describe('fetchImageAsBase64', () => {
  it('decodes a data: URL without fetching', async () => {
    const b64 = Buffer.from('hi').toString('base64');
    const out = await fetchImageAsBase64(`data:image/png;base64,${b64}`);
    expect(out).toEqual({ url: expect.any(String), mime: 'image/png', b64 });
  });
});

describe('gatherInputImages', () => {
  const steps = [{ name: 'Scene' }, { name: 'Logo' }, { name: 'Compose' }];
  // step 0 (Scene) + step 1 (Logo) each have one image asset; data: URLs so no network.
  const img = (s: string) => `data:image/png;base64,${Buffer.from(s).toString('base64')}`;
  const assetsForStep = (i: number) =>
    i === 0 ? [{ type: 'image', url: img('scene') }]
    : i === 1 ? [{ type: 'image', url: img('logo') }]
    : [];

  it('resolves {step:Name} refs to those steps image assets', async () => {
    const out = await gatherInputImages('{step:Scene} with {step:Logo}', steps, 2, assetsForStep);
    expect(out.map((o) => Buffer.from(o.b64, 'base64').toString())).toEqual(['scene', 'logo']);
  });

  it('{input} resolves to the most recent prior step that has an image', async () => {
    const out = await gatherInputImages('edit {input}', steps, 2, assetsForStep);
    expect(Buffer.from(out[0].b64, 'base64').toString()).toBe('logo'); // step 1, the latest with an image
  });

  it('returns [] for a plain prompt', async () => {
    expect(await gatherInputImages('a red shoe', steps, 2, assetsForStep)).toEqual([]);
  });

  it('caps the number of inputs', async () => {
    const many = (i: number) => (i < 5 ? [{ type: 'image', url: img(`s${i}`) }] : []);
    const refs = '{step:a}{step:b}{step:c}{step:d}{step:e}';
    const namedSteps = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name }));
    const out = await gatherInputImages(refs, [...namedSteps, { name: 'z' }], 5, many, 4);
    expect(out).toHaveLength(4);
  });
});
