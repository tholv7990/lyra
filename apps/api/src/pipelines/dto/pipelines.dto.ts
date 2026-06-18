import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Provider,
  StepMode,
  TAG_MAX,
  TAG_MAX_LEN,
  type ConditionOp,
  type CreatePipelineDto,
  type FanOutConfig,
  type GeneratePipelineDto,
  type PipelineOrigin,
  type PipelineStepInput,
  type PipelineVariableInput,
  type StepCondition,
  type UpdatePipelineDto,
} from '@lyra/shared';

const CONDITION_OPS: ConditionOp[] = ['eq', 'ne', 'contains', 'exists', 'empty', 'gt', 'lt'];

export class FanOutBody implements FanOutConfig {
  @IsString()
  @MinLength(1)
  over!: string;

  @IsOptional()
  @IsString()
  itemVar?: string;
}

export class ConditionBody implements StepCondition {
  @IsString()
  @MinLength(1)
  variable!: string;

  @IsIn(CONDITION_OPS)
  op!: ConditionOp;

  @IsOptional()
  @IsString()
  value?: string;
}

export class PipelineVariableBody implements PipelineVariableInput {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  default?: string;
}

export class PipelineStepBody implements PipelineStepInput {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  // May be '' — a "gap" step the AI couldn't match to a library prompt yet.
  @IsString()
  promptId!: string;

  @IsEnum(Provider)
  provider!: Provider;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsEnum(StepMode)
  mode!: StepMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => FanOutBody)
  fanOut?: FanOutBody;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionBody)
  condition?: ConditionBody;
}

export class PipelineOriginBody implements PipelineOrigin {
  @IsIn(['ai', 'manual'])
  source!: 'ai' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  goal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;
}

export class GeneratePipelineBody implements GeneratePipelineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  goal!: string;

  // Present when revising an existing pipeline ("Edit with AI") — the current
  // steps the AI rewrites against the instruction.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PipelineStepBody)
  current?: PipelineStepBody[];
}

export class CreatePipelineBody implements CreatePipelineDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LEN, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineStepBody)
  steps?: PipelineStepBody[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PipelineVariableBody)
  variables?: PipelineVariableBody[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PipelineOriginBody)
  origin?: PipelineOriginBody;
}

export class UpdatePipelineBody implements UpdatePipelineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LEN, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineStepBody)
  steps?: PipelineStepBody[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PipelineVariableBody)
  variables?: PipelineVariableBody[];
}
