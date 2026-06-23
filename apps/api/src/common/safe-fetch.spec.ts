import { BadRequestException } from '@nestjs/common';

// Mock node:dns/promises before importing the module under test
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'node:dns/promises';
import { safeFetch } from './safe-fetch';

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
