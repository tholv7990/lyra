import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Provider,
  type CreateConversationDto,
  type FindPromptConversationDto,
  type SendChatMessageDto,
  type UpdateConversationDto,
} from '@lyra/shared';
import { PromptMediaBody } from '../../prompts/dto/prompts.dto';

const TITLE_MAX = 120;

export class CreateConversationBody implements CreateConversationDto {
  @IsEnum(Provider)
  provider!: Provider;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  originPromptId?: string;
}

export class SendChatMessageBody implements SendChatMessageDto {
  @IsEnum(Provider)
  provider!: Provider;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptMediaBody)
  media?: PromptMediaBody[];
}

export class UpdateConversationBody implements UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsBoolean()
  starred?: boolean;
}

export class FindPromptConversationBody implements FindPromptConversationDto {
  @IsString()
  @MinLength(1)
  promptId!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
