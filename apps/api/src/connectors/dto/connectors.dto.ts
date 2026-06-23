import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { DownloadDto, PublishDto, ResolveDto, SaveCredentialDto, SetCrawlerCookiesDto } from '@lyra/shared';

export class SaveCredentialBody implements SaveCredentialDto {
  @IsString() @MinLength(1) @IsIn(['postiz', 'apify', 'tavily', 'firecrawl']) connector!: string;
  @IsString() @MinLength(1) apiKey!: string;
}

export class PublishBody implements PublishDto {
  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) channelIds!: string[];
  @IsString() caption!: string;
  @IsArray() @IsString({ each: true }) mediaUrls!: string[];
}

// SECURITY: do NOT add a `cookies` field to these browser-facing bodies. Cookies are
// server-injected only (decrypted from the workspace store in the controller); leaving
// them off these DTOs means `whitelist: true` strips any client-supplied `cookies`, so
// a caller can never smuggle or echo cookies via /resolve or /download.
export class ResolveBody implements ResolveDto {
  @IsString() @MinLength(1) url!: string;
}

export class DownloadBody implements DownloadDto {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() indices?: number[];
  @IsOptional() @IsString() @MinLength(1) format?: string;
}

export class SetCookiesBody implements SetCrawlerCookiesDto {
  // A cookies.txt (Netscape) export; capped to keep a single blob sane (~256KB).
  @IsString() @MinLength(1) @MaxLength(262144) cookies!: string;
}
