import { Injectable } from '@nestjs/common';

@Injectable()
export class ApifyClient {
  // Runs an actor synchronously and returns its dataset items. The token is the
  // workspace's BYO Apify key (never stored here — passed per call).
  async runActor(actorId: string, input: object, token: string): Promise<unknown[]> {
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`;
    const res = await fetch(url, {
      method: 'POST',
      // Bearer header (not ?token= query) so the BYO key never lands in a URL/access log.
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error(`apify ${actorId} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : [];
  }
}
