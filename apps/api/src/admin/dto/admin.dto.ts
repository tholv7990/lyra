import { IsBoolean } from 'class-validator';
import type { UpdateUserStatusDto } from '@lyra/shared';

// Toggle a user's active status from the admin Users section. Implements the
// shared contract so the request shape can't drift from @lyra/shared.
export class UpdateUserStatusBody implements UpdateUserStatusDto {
  @IsBoolean()
  active!: boolean;
}
