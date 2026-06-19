import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MediaType,
  PromptStatus,
  PromptType,
  Provider,
  TAG_MAX,
  TAG_MAX_LEN,
} from '@lyra/shared';
import type {
  CreatePromptDto,
  PromptMedia,
  SaveResultDto,
  UpdatePromptDto,
  UpdateResultDto,
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

// Save an answer as a child result of a prompt (the chat "Save" action).
export class SaveResultBody implements SaveResultDto {
  @IsString()
  @MinLength(1)
  output!: string;

  @IsEnum(Provider)
  provider!: Provider;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsOptional()
  @IsString()
  promptSnapshot?: string;

  @IsOptional()
  @IsString()
  sourceConversationId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdateResultBody implements UpdateResultDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
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
