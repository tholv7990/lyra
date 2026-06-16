import { IsString } from 'class-validator';
import type { UpdateStepPromptDto } from '@lyra/shared';

export class UpdatePromptBody implements UpdateStepPromptDto {
  @IsString()
  prompt!: string;
}
