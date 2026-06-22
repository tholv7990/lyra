import { sweepOrphanTempDirs } from './temp-sweep';
import { promises as fs } from 'fs';

describe('sweepOrphanTempDirs', () => {
  afterEach(() => jest.restoreAllMocks());
  it('removes stale lyra-dl-*/lyra-ck-* dirs and leaves fresh/unrelated ones', async () => {
    const now = 10_000_000;
    jest.spyOn(fs, 'readdir').mockResolvedValue(['lyra-dl-old', 'lyra-ck-old', 'lyra-dl-fresh', 'something-else'] as never);
    jest.spyOn(fs, 'stat').mockImplementation(async (p) => ({
      isDirectory: () => true,
      mtimeMs: String(p).includes('fresh') ? now - 1000 : now - 7_200_000, // fresh=1s, old=2h
    }) as never);
    const rm = jest.spyOn(fs, 'rm').mockResolvedValue(undefined as never);
    await sweepOrphanTempDirs({ dir: '/tmp', maxAgeMs: 3_600_000, now });
    const removed = rm.mock.calls.map((c) => String(c[0]));
    expect(removed.some((p) => p.includes('lyra-dl-old'))).toBe(true);
    expect(removed.some((p) => p.includes('lyra-ck-old'))).toBe(true);
    expect(removed.some((p) => p.includes('fresh'))).toBe(false);
    expect(removed.some((p) => p.includes('something-else'))).toBe(false);
  });
  it('never throws if a removal fails', async () => {
    jest.spyOn(fs, 'readdir').mockResolvedValue(['lyra-dl-x'] as never);
    jest.spyOn(fs, 'stat').mockResolvedValue({ isDirectory: () => true, mtimeMs: 0 } as never);
    jest.spyOn(fs, 'rm').mockRejectedValue(new Error('EBUSY'));
    await expect(sweepOrphanTempDirs({ dir: '/tmp', now: 9_999_999 })).resolves.toBeUndefined();
  });
});
