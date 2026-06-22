import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// Durable storage for generated media. When the R2_* env vars are set, bytes are
// uploaded to Cloudflare R2 (S3-compatible) and a public URL is returned; that
// moves media OUT of MongoDB. Otherwise it falls back to an inline data: URL
// (works for display + download, but the bytes live in the asset document).
//
// Required env to enable R2:
//   R2_ENDPOINT            https://<accountid>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID       (R2 API token access key)
//   R2_SECRET_ACCESS_KEY   (R2 API token secret)
//   R2_BUCKET              bucket name
//   R2_PUBLIC_URL          public base URL for the bucket (r2.dev or a custom domain)
@Injectable()
export class AssetStorageService {
  private readonly log = new Logger(AssetStorageService.name);
  private readonly client?: S3Client;
  private readonly bucket?: string;
  private readonly publicUrl?: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('R2_ENDPOINT');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = config.get<string>('R2_BUCKET');
    const publicUrl = config.get<string>('R2_PUBLIC_URL');
    if (endpoint && accessKeyId && secretAccessKey && bucket && publicUrl) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.bucket = bucket;
      this.publicUrl = publicUrl.replace(/\/+$/, '');
      this.log.log('R2 asset storage enabled');
    }
  }

  get enabled(): boolean {
    return !!this.client;
  }

  // Store bytes and return a URL to serve them. R2 when configured, else inline.
  async store(bytes: Buffer, contentType: string, key: string): Promise<string> {
    if (this.client && this.bucket && this.publicUrl) {
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
          }),
        );
        return `${this.publicUrl}/${key}`;
      } catch (e) {
        this.log.error(
          `R2 upload failed (${e instanceof Error ? e.message : 'error'}) — falling back to inline storage`,
        );
      }
    }
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  }

  // Store an image plus a small webp thumbnail (R2 only — the data: fallback would
  // double-inline base64, so it returns the full image with no thumb). Best-effort:
  // any thumb/upload failure returns the full url with no thumbUrl (never throws).
  async storeImage(
    bytes: Buffer,
    contentType: string,
    key: string,
  ): Promise<{ url: string; thumbUrl?: string }> {
    const url = await this.store(bytes, contentType, key);
    if (!this.enabled || !contentType.startsWith('image/')) return { url };
    try {
      const thumb = await sharp(bytes)
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbUrl = await this.store(thumb, 'image/webp', `thumbs/${key}.webp`);
      return { url, thumbUrl };
    } catch (e) {
      this.log.warn(`thumbnail failed (${e instanceof Error ? e.message : 'error'}) — using full image`);
      return { url };
    }
  }
}
