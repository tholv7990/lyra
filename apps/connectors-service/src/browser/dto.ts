import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

// Platforms with an upload script. Add a scripts/<name>.upload.ts + a runner case.
export const BROWSER_PLATFORMS = ['tiktok', 'youtube'] as const;
export type BrowserPlatform = (typeof BROWSER_PLATFORMS)[number];

export class BrowserPublishBody {
  @IsIn(BROWSER_PLATFORMS) platform!: BrowserPlatform;
  // GoLogin profile id that is ALREADY logged into the target account.
  @IsString() profileId!: string;
  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) mediaUrls!: string[];
  @IsString() caption!: string;
  // Open the upload page and stop before submitting — for testing the plumbing
  // without actually posting.
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
