import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class RenderClient {
  constructor(private readonly config: ConfigService) {}

  async renderImage(req: RenderImageReq): Promise<RenderImageRes> {
    const base = this.config.get<string>('RENDER_SERVICE_URL') ?? 'http://localhost:9200';
    const res = await fetch(`${base}/render-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.config.get('RENDER_SERVICE_TOKEN') ?? '',
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`render-service ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as RenderImageRes;
  }
}
