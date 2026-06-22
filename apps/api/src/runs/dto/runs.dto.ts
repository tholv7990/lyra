import { IsBoolean, IsIn, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';
import type { RateRunDto, RunPipelineDto, RunStepDto, UpdateStepPromptDto } from '@lyra/shared';

export class UpdatePromptBody implements UpdateStepPromptDto {
  @IsString()
  prompt!: string;
}

// Rate a run's overall output. `value: null` clears it (validation runs only when
// a value is present, so null passes through to clear the rating).
export class RateRunBody implements RateRunDto {
  @ValidateIf((o) => o.value !== null && o.value !== undefined)
  @IsIn(['up', 'down'])
  value!: 'up' | 'down' | null;
}

// Optional flags for re-running a single step (e.g. Regenerate bypasses cache).
export class RunStepBody implements RunStepDto {
  @IsOptional()
  @IsBoolean()
  bypassCache?: boolean;
}

// Optional per-run variable values entered when starting a pipeline run.
export class RunPipelineBody implements RunPipelineDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  // Named lists a fan-out step maps over (e.g. the source images to brand).
  @IsOptional()
  @IsObject()
  collections?: Record<string, string[]>;
}
