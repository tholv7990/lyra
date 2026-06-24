import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReviewResult } from '@lyra/shared';

export interface RenderImageReq {
  imageUrl: string;
  logoUrl: string;
  position: string;
  size: string;
}

export interface RenderImageRes {
  url: string;
  width: number;
  height: number;
}

export interface ReviewReq {
  assetUrl: string;
  expect?: { aspect?: '9:16' | '1:1' | '16:9'; minWidth?: number };
}

@Injectable()
export class RenderClient {
  private readonly log = new Logger(RenderClient.name);
  constructor(private readonly config: ConfigService) {}

  async renderImage(req: RenderImageReq): Promise<RenderImageRes> {
    const base = this.config.get<string>('RENDER_SERVICE_URL') ?? 'http://localhost:9200';
    const res = await fetch(`${base}/render-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.get('RENDER_SERVICE_TOKEN') ?? ''}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`render-service ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as RenderImageRes;
  }

  // Post-render technical QA. FAIL-OPEN on a transport/5xx error: a QA-service
  // outage must never block a run, so return pass:true + log. (A genuine asset
  // problem comes back from the service as pass:false; only outages fail open.)
  async review(req: ReviewReq): Promise<ReviewResult> {
    const base = this.config.get<string>('RENDER_SERVICE_URL') ?? 'http://localhost:9200';
    try {
      const res = await fetch(`${base}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.get('RENDER_SERVICE_TOKEN') ?? ''}`,
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        this.log.warn(`review fail-open: render-service ${res.status}`);
        return { pass: true, issues: [] };
      }
      return (await res.json()) as ReviewResult;
    } catch (e) {
      this.log.warn(`review fail-open: ${e instanceof Error ? e.message : 'unreachable'}`);
      return { pass: true, issues: [] };
    }
  }
}
