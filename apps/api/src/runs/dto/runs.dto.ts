import { IsObject, IsOptional, IsString } from 'class-validator';
import type { RunPipelineDto, UpdateStepPromptDto } from '@lyra/shared';

export class UpdatePromptBody implements UpdateStepPromptDto {
  @IsString()
  prompt!: string;
}

// Optional per-run variable values entered when starting a pipeline run.
export class RunPipelineBody implements RunPipelineDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
