import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LABEL_COLOR_VALUES, TAG_MAX_LEN } from '@lyra/shared';
import type { CreateLabelDto, UpdateLabelDto } from '@lyra/shared';

export class CreateLabelBody implements CreateLabelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TAG_MAX_LEN)
  name!: string;

  @IsString()
  @IsIn(LABEL_COLOR_VALUES)
  color!: string;
}

export class UpdateLabelBody implements UpdateLabelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TAG_MAX_LEN)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(LABEL_COLOR_VALUES)
  color?: string;
}
