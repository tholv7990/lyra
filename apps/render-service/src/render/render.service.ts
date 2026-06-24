import { Injectable } from '@nestjs/common';
import sharp, { type Metadata as SharpMetadata } from 'sharp';
import { RenderStore } from './render.store';
import { ReviewDto } from './dto';

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

  async review(dto: ReviewDto): Promise<{ pass: boolean; issues: string[] }> {
    const issues: string[] = [];

    let buf: Buffer;
    try {
      buf = await this.fetchBuffer(dto.assetUrl);
    } catch {
      return { pass: false, issues: ['could not fetch asset'] };
    }

    let meta: SharpMetadata;
    try {
      meta = await sharp(buf).metadata();
    } catch {
      return { pass: false, issues: ['could not decode image'] };
    }

    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    if (!meta.width || !meta.height) {
      issues.push('image is missing dimensions');
    } else {
      if (w < 256) issues.push(`width ${w} < 256`);
      if (h < 256) issues.push(`height ${h} < 256`);
    }

    // Blankness check
    try {
      const stats = await sharp(buf).stats();
      const allFlat = stats.channels.every((ch) => ch.stdev < 1);
      if (allFlat) issues.push('image is blank or solid color');
    } catch {
      // stats failure is non-fatal; skip blank check
    }

    // Aspect ratio check
    if (dto.expect?.aspect && meta.width && meta.height) {
      const RATIOS: Record<string, number> = {
        '9:16': 9 / 16,
        '1:1': 1,
        '16:9': 16 / 9,
      };
      const target = RATIOS[dto.expect.aspect];
      const actual = w / h;
      if (Math.abs(actual - target) / target > 0.05) {
        issues.push(
          `aspect ratio ${actual.toFixed(4)} does not match expected ${dto.expect.aspect} (${target.toFixed(4)}) within 5%`,
        );
      }
    }

    // Min-width check
    if (dto.expect?.minWidth !== undefined && meta.width && w < dto.expect.minWidth) {
      issues.push(`width ${w} < minWidth ${dto.expect.minWidth}`);
    }

    return { pass: issues.length === 0, issues };
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
