import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { DownloadDto, PublishDto, ResolveDto, SaveCredentialDto } from '@lyra/shared';

export class SaveCredentialBody implements SaveCredentialDto {
  @IsString() @MinLength(1) @IsIn(['postiz']) connector!: string;
  @IsString() @MinLength(1) apiKey!: string;
}

export class PublishBody implements PublishDto {
  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) channelIds!: string[];
  @IsString() caption!: string;
  @IsArray() @IsString({ each: true }) mediaUrls!: string[];
}

export class ResolveBody implements ResolveDto {
  @IsString() @MinLength(1) url!: string;
}

export class DownloadBody implements DownloadDto {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() indices?: number[];
}
