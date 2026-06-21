import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreatePublishedPostDto, Receipt } from '@lyra/shared';

class TargetBody implements Receipt {
  @IsString() platform!: string;
  @IsString() accountId!: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() postId?: string;
  @IsIn(['ok', 'failed']) status!: 'ok' | 'failed';
  @IsOptional() @IsString() error?: string;
}

export class CreatePublishedPostBody implements CreatePublishedPostDto {
  @IsString() @MaxLength(5000) caption!: string;

  @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) mediaUrls!: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TargetBody)
  targets!: Receipt[];
}
