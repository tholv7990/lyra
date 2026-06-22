import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus, ProjectShare } from '@lyra/shared';
import type {
  CreateProjectDto,
  ProjectVariableInput,
  UpdateProjectDto,
  ProjectBrandKit,
} from '@lyra/shared';

export class ProjectVariableBody implements ProjectVariableInput {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MaxLength(4000)
  value!: string;
}

export class ProjectBrandKitBody implements ProjectBrandKit {
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;
}

export class CreateProjectBody implements CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ProjectVariableBody)
  variables?: ProjectVariableBody[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(ProjectShare)
  shared?: ProjectShare;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWith?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  channels?: string[];
}

export class UpdateProjectBody implements UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ProjectVariableBody)
  variables?: ProjectVariableBody[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(ProjectShare)
  shared?: ProjectShare;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWith?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  channels?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectBrandKitBody)
  brandKit?: ProjectBrandKitBody;
}
