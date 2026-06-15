import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { api, setAccessToken, ApiError } from './api';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => body,
  } as unknown as Response;
}

describe('api fetch wrapper', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('attaches the Bearer access token when set', async () => {
    setAccessToken('tok-123');
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await api('/auth/me');

    const init = (fetchMock as Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(init.credentials).toBe('include');
  });

  it('on 401 it refreshes once, then retries the original request', async () => {
    const fetchMock = vi
      .fn()
      // 1) original request -> 401
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      // 2) /auth/refresh -> new token
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
      // 3) retried original -> success
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await api<{ data: string }>('/projects');

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1][0] as string)).toContain('/auth/refresh');
    // retried request carried the refreshed token
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer fresh-token');
  });

  it('throws ApiError with the server message on a non-retried failure', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(409, { message: 'Email already registered' }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(api('/auth/signup', { method: 'POST', retry: false })).rejects.toMatchObject({
      status: 409,
      message: 'Email already registered',
    });
    await expect(api('/auth/signup', { method: 'POST', retry: false })).rejects.toBeInstanceOf(ApiError);
  });

  it('joins array validation messages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(400, { message: ['email must be an email', 'password too short'] }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(api('/auth/signup', { method: 'POST', retry: false })).rejects.toMatchObject({
      status: 400,
      message: 'email must be an email, password too short',
    });
  });
});
