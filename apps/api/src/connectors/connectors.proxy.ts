import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Map the service's download response (fileId-based) to browser-facing Lyra file
// URLs; leave absolute urls (mock mode) untouched.
export function rewriteDownload(
  workspaceId: string,
  body: { items?: { fileId?: string; url?: string; filename: string }[] },
): { items: { url: string; filename: string }[] } {
  const items = (body.items ?? []).map((it) =>
    it.fileId
      ? { url: `/workspaces/${workspaceId}/connectors/files/${it.fileId}`, filename: it.filename }
      : { url: it.url ?? '', filename: it.filename },
  );
  return { items };
}

// Thin proxy: forward to the connectors microservice when CONNECTORS_SERVICE_URL is
// set, else return deterministic mock data so the UI works with no microservice
// (env-gated, mirroring the R2 inline-vs-R2 fallback). No connector logic lives here.
@Injectable()
export class ConnectorsProxy {
  constructor(private readonly config: ConfigService) {}

  async forward(
    workspaceId: string,
    userId: string,
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const base = this.config.get<string>('CONNECTORS_SERVICE_URL');
    if (!base) return this.mock(path);

    const token = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
    const res = await fetch(`${base.replace(/\/+$/, '')}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Workspace-Id': workspaceId,
        'X-User-Id': userId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  }

  async streamFile(path: string): Promise<{ status: number; headers: Headers; body: ReadableStream | null }> {
    const base = this.config.get<string>('CONNECTORS_SERVICE_URL');
    if (!base) return { status: 404, headers: new Headers(), body: null }; // mock mode: no real files
    const token = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
    const res = await fetch(`${base.replace(/\/+$/, '')}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, headers: res.headers, body: res.body };
  }

  // Deterministic mock for the env-gated fallback (no microservice running).
  private mock(path: string): Record<string, unknown> {
    if (path === 'channels') {
      return {
        channels: [
          { id: 'mock-tt', platform: 'tiktok', displayName: '@mock.tiktok' },
          { id: 'mock-ig', platform: 'instagram', displayName: '@mock.instagram' },
        ],
      };
    }
    if (path.startsWith('connect-link')) return { url: '#mock-connect' };
    if (path === 'credentials') return { ok: true };
    if (path === 'publish') return { jobId: 'mock-job-1', status: 'queued' };
    if (path.startsWith('jobs/')) {
      return {
        jobId: path.slice('jobs/'.length),
        status: 'done',
        receipts: [
          { platform: 'tiktok', accountId: 'mock-tt', status: 'ok', url: 'https://example.com/mock-tt' },
          { platform: 'instagram', accountId: 'mock-ig', status: 'ok', url: 'https://example.com/mock-ig' },
        ],
      };
    }
    if (path.startsWith('channels/')) return { ok: true }; // DELETE channels/:id
    if (path === 'resolve') {
      return {
        items: [
          { index: 0, type: 'video', filename: 'clip.mp4' },
          { index: 1, type: 'image', filename: '1.jpg' },
        ],
      };
    }
    if (path === 'download') {
      return { items: [{ url: 'https://example.com/mock-download', filename: 'media.zip' }] };
    }
    return {};
  }
}
