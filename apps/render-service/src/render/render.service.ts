import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { RenderStore } from './render.store';

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

// sharp gravity per corner (center = centered overlay).
const GRAVITY: Record<string, string> = {
  tl: 'northwest',
  tr: 'northeast',
  bl: 'southwest',
  br: 'southeast',
  center: 'center',
};

// logo width in px per size bucket.
const SIZE_PX: Record<string, number> = {
  sm: 96,
  md: 160,
  lg: 240,
};

@Injectable()
export class RenderService {
  constructor(private readonly store: RenderStore) {}

  async renderImage(req: RenderImageReq): Promise<RenderImageRes> {
    const [baseBuf, logoBufRaw] = await Promise.all([
      this.fetchBuffer(req.imageUrl),
      this.fetchBuffer(req.logoUrl),
    ]);
    const logoWidth = SIZE_PX[req.size] ?? SIZE_PX.md;
    const gravity = GRAVITY[req.position] ?? GRAVITY.br;
    const logoBuf = await sharp(logoBufRaw)
      .resize({ width: logoWidth, withoutEnlargement: true })
      .png()
      .toBuffer();
    const base = sharp(baseBuf);
    const meta = await base.metadata();
    const out = await base.composite([{ input: logoBuf, gravity }]).png().toBuffer();
    const url = await this.store.save(out);
    return { url, width: meta.width ?? 0, height: meta.height ?? 0 };
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
