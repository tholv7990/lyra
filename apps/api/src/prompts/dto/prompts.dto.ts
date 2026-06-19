import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MediaType,
  PromptCategory,
  PromptStatus,
  PromptType,
  Provider,
  TAG_MAX,
  TAG_MAX_LEN,
} from '@lyra/shared';
import type {
  CreatePromptDto,
  PromptMedia,
  UpdatePromptDto,
} from '@lyra/shared';

// Nested media item — validated per-element via @ValidateNested + @Type.
export class PromptMediaBody implements PromptMedia {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsString()
  @MinLength(1)
  url!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mime?: string;

  @IsOptional()
  @IsNumber()
  size?: number;
}

export class CreatePromptBody implements CreatePromptDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(PromptStatus)
  status?: PromptStatus;

  @IsOptional()
  @IsEnum(PromptType)
  type?: PromptType;

  // Optional metadata. @IsOptional lets `null` through so the web can clear it.
  @IsOptional()
  @IsEnum(PromptCategory)
  category?: PromptCategory;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptMediaBody)
  media?: PromptMediaBody[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LEN, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(Provider)
  provider?: Provider;

  @IsOptional()
  @IsString()
  model?: string;
}

export class UpdatePromptBody implements UpdatePromptDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(PromptStatus)
  status?: PromptStatus;

  @IsOptional()
  @IsEnum(PromptType)
  type?: PromptType;

  // Optional metadata. @IsOptional lets `null` through so the web can clear it.
  @IsOptional()
  @IsEnum(PromptCategory)
  category?: PromptCategory;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptMediaBody)
  media?: PromptMediaBody[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LEN, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(Provider)
  provider?: Provider;

  @IsOptional()
  @IsString()
  model?: string;
}
