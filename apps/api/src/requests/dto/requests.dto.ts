import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RequestType, RequestStatus } from '@lyra/shared';
import type { CreateRequestDto, UpdateRequestStatusDto } from '@lyra/shared';

// Implements the shared contract so the request shape can't drift from @lyra/shared.
export class CreateRequestBody implements CreateRequestDto {
  @IsEnum(RequestType)
  type!: RequestType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}

export class UpdateRequestStatusBody implements UpdateRequestStatusDto {
  @IsEnum(RequestStatus)
  status!: RequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
