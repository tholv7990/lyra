import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ProjectVisibility } from '@lyra/shared';
import type { CreateProjectDto, UpdateProjectDto } from '@lyra/shared';

export class CreateProjectBody implements CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  product!: string;

  @IsString()
  niche!: string;

  @IsString()
  homepageUrl!: string;
}

export class UpdateProjectBody implements UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsString()
  niche?: string;

  @IsOptional()
  @IsString()
  homepageUrl?: string;

  @IsOptional()
  @IsObject()
  brandBrief?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(ProjectVisibility)
  visibility?: ProjectVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWith?: string[];
}
