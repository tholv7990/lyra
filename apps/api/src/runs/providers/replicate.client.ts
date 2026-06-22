import { Injectable } from '@nestjs/common';

const API = 'https://api.replicate.com/v1';
const POLL_INTERVAL_MS = 5000;
const POLL_DEADLINE_MS = 240_000; // ~4 min, just under the browser fetch ceiling

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Prediction {
  id: string;
  status: string; // starting | processing | succeeded | failed | canceled
  output?: unknown;
  error?: string;
}

// Thin raw-fetch client for Replicate predictions (video). Mirrors gemini.client.ts —
// no SDK. The BYO token rides in the Authorization: Bearer header (never a URL/log).
@Injectable()
export class ReplicateClient {
  // Create a prediction, poll until terminal, return the first output URL.
  async run(
    model: string,
    input: object,
    token: string,
    opts: { intervalMs?: number; deadlineMs?: number } = {},
  ): Promise<string> {
    if (!/^[\w.-]+\/[\w.-]+$/.test(model)) {
      throw new Error(`Invalid Replicate model slug: ${model}`);
    }
    const created = await this.create(model, input, token);
    const final = await this.pollUntilDone(created.id, token, opts);
    const out = final.output;
    const url = Array.isArray(out) ? out[0] : out;
    if (typeof url !== 'string' || !url) throw new Error('Replicate returned no video output.');
    return url;
  }

  private async create(model: string, input: object, token: string): Promise<Prediction> {
    const res = await fetch(`${API}/models/${model}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<Prediction> & { detail?: string };
    if (!res.ok || !data.id) {
      throw new Error(`replicate create ${model} -> ${res.status}: ${(data.detail ?? '').slice(0, 200)}`);
    }
    return data as Prediction;
  }

  private async get(id: string, token: string): Promise<Prediction> {
    const res = await fetch(`${API}/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`replicate get ${id} -> ${res.status}`);
    return (await res.json()) as Prediction;
  }

  private async pollUntilDone(
    id: string,
    token: string,
    opts: { intervalMs?: number; deadlineMs?: number },
  ): Promise<Prediction> {
    const interval = opts.intervalMs ?? POLL_INTERVAL_MS;
    const deadline = Date.now() + (opts.deadlineMs ?? POLL_DEADLINE_MS);
    for (;;) {
      const p = await this.get(id, token);
      if (p.status === 'succeeded') return p;
      if (p.status === 'failed' || p.status === 'canceled') {
        throw new Error(`Replicate prediction ${p.status}: ${(p.error ?? '').slice(0, 200)}`);
      }
      if (Date.now() >= deadline) {
        throw new Error('Video render exceeded the time limit — try a faster model or Regenerate.');
      }
      await sleep(interval);
    }
  }
}
