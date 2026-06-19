import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type {
  AdoptMarketplacePromptDto,
  MarketplaceRankDto,
} from '@lyra/shared';

// AI filter request — a free-text need + optional result cap.
export class MarketplaceRankBody implements MarketplaceRankDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  limit?: number;
}

// Adopt a catalog item into the workspace library.
export class AdoptMarketplacePromptBody implements AdoptMarketplacePromptDto {
  @IsString()
  @MinLength(1)
  promptId!: string;
}
