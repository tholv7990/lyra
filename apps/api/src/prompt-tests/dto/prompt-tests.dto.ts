import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  Provider,
  TAG_MAX,
  TAG_MAX_LEN,
  type CreatePromptTestDto,
  type UpdatePromptTestDto,
} from '@lyra/shared';

export class CreatePromptTestBody implements CreatePromptTestDto {
  @IsEnum(Provider)
  provider!: Provider;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsString()
  @MinLength(1)
  input!: string;
}

export class UpdatePromptTestBody implements UpdatePromptTestDto {
  @IsOptional()
  @IsBoolean()
  starred?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LEN, { each: true })
  tags?: string[];
}
