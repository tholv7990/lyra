import { IsString, MinLength } from 'class-validator';
import type { UpsertKeyDto } from '@lyra/shared';

export class UpsertKeyBody implements UpsertKeyDto {
  @IsString()
  @MinLength(1)
  key!: string;
}
