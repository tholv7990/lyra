import { IsMongoId } from 'class-validator';
import type { TransferProjectDto } from '@lyra/shared';

export class TransferProjectBody implements TransferProjectDto {
  @IsMongoId()
  targetWorkspaceId!: string;
}
