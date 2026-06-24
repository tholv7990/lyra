import { BadRequestException } from '@nestjs/common';

// Mock node:dns/promises before importing the module under test
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'node:dns/promises';
import { safeFetch, safeFetchFollow } from './safe-fetch';

const mockLookup = lookup as jest.MockedFunction<typeof lookup>;

// We need a global fetch mock
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

afterEach(() => {
  jest.clearAllMocks();
});

describe('safeFetch', () => {
  it('rejects a literal private URL before any DNS/fetch (assertSafeUrl guard)', async () => {
    await expect(safeFetch('http://169.254.169.254/')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a public hostname that DNS-resolves to 127.0.0.1 (rebind blocked)', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a public hostname that DNS-resolves to 10.0.0.5 (private range rebind)', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes for a public hostname resolving to a public IP and calls fetch with redirect:error', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    const fakeResponse = { ok: true, status: 200 } as Response;
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await safeFetch('https://example.com/img.jpg');

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/img.jpg', { redirect: 'error' });
    expect(result).toBe(fakeResponse);
  });

  it('rejects when any one of multiple DNS results is private (all-must-be-public)', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ] as never);
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects when DNS lookup fails (host unreachable)', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(safeFetch('https://nonexistent.invalid/img.jpg')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('safeFetchFollow', () => {
  const headers = (h: Record<string, string> = {}) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

  it('rejects a literal private URL before any DNS/fetch', async () => {
    await expect(safeFetchFollow('http://169.254.169.254/')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a non-http scheme', async () => {
    await expect(safeFetchFollow('file:///etc/passwd')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a public host that DNS-resolves private (rebind blocked)', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(safeFetchFollow('https://evil.example/')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns the body for a public 200', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    mockFetch.mockResolvedValue({ ok: true, status: 200, headers: headers(), text: async () => '<html>hi</html>' });
    await expect(safeFetchFollow('https://ok.example/')).resolves.toEqual({ ok: true, status: 200, body: '<html>hi</html>' });
    expect(mockFetch).toHaveBeenCalledWith('https://ok.example/', expect.objectContaining({ redirect: 'manual' }));
  });

  it('follows a public→public redirect and returns the final body', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 301, headers: headers({ location: 'https://ok.example/final' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: headers(), text: async () => 'final' });
    await expect(safeFetchFollow('https://ok.example/start')).resolves.toEqual({ ok: true, status: 200, body: 'final' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('blocks a redirect to a private host on the second hop', async () => {
    mockLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }] as never);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 302, headers: headers({ location: 'http://rebind.example/' }) });
    await expect(safeFetchFollow('https://ok.example/')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
