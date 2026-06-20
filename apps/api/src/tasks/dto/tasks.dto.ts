import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TaskStatus, TaskPriority } from '@lyra/shared';
import type { CreateTaskDto, UpdateTaskDto } from '@lyra/shared';

export class CreateTaskBody implements CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pipelines?: string[];
}

export class UpdateTaskBody implements UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  // `null` clears the assignee — @IsOptional() skips validation for null/undefined,
  // so a string is validated and null passes through to mean "clear".
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pipelines?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
