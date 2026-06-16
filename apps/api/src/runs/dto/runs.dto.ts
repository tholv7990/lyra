import { IsString } from 'class-validator';
import type { UpdatePromptDto } from '@lyra/shared';

export class UpdatePromptBody implements UpdatePromptDto {
  @IsString()
  prompt!: string;
}
