import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

// Platforms with an upload script. Add a scripts/<name>.upload.ts + a runner case.
export const BROWSER_PLATFORMS = ['tiktok', 'youtube', 'facebook', 'instagram'] as const;
export type BrowserPlatform = (typeof BROWSER_PLATFORMS)[number];

export class BrowserPublishBody {
  @IsIn(BROWSER_PLATFORMS) platform!: BrowserPlatform;

  // ── exactly one of the two below ──
  // SDK-launch mode (production): GoLogin opens this profile (needs GOLOGIN_API_TOKEN),
  // posts, then stops it. Unattended + scalable.
  @IsOptional() @IsString() profileId?: string;
  // Attach mode (dev/tuning): Puppeteer connects to a profile you already opened in
  // the GoLogin app — pass its CDP endpoint (ws://127.0.0.1:<port>…). No token/SDK,
  // and we don't close your browser. Best for tuning selectors + handling captchas.
  @IsOptional() @IsString() wsEndpoint?: string;

  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) mediaUrls!: string[];
  @IsString() caption!: string;
  // Open the upload page and stop before submitting — test the plumbing without posting.
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

// Exactly one of profileId / wsEndpoint must be set. Returns the mode, or null if the
// body provides neither or both (the controller turns null into a 400).
export function publishMode(b: { profileId?: string; wsEndpoint?: string }): 'profile' | 'attach' | null {
  const hasProfile = !!b.profileId;
  const hasWs = !!b.wsEndpoint;
  if (hasProfile === hasWs) return null;
  return hasProfile ? 'profile' : 'attach';
}
