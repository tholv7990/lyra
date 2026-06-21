import { publishMode } from './dto';

describe('publishMode (exactly one of profileId / wsEndpoint)', () => {
  it('profileId → SDK-launch mode', () => {
    expect(publishMode({ profileId: 'p1' })).toBe('profile');
  });
  it('wsEndpoint → attach mode', () => {
    expect(publishMode({ wsEndpoint: 'ws://127.0.0.1:1234/dev' })).toBe('attach');
  });
  it('rejects neither (null → 400)', () => {
    expect(publishMode({})).toBeNull();
  });
  it('rejects both (null → 400)', () => {
    expect(publishMode({ profileId: 'p1', wsEndpoint: 'ws://x' })).toBeNull();
  });
});
