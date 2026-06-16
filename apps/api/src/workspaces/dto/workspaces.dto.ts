import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@lyra/shared';
import type {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteDto,
  AcceptInviteDto,
  UpdateMemberDto,
} from '@lyra/shared';

export class CreateWorkspaceBody implements CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateWorkspaceBody implements UpdateWorkspaceDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class InviteBody implements InviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}

export class AcceptInviteBody implements AcceptInviteDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

export class UpdateMemberBody implements UpdateMemberDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  canManageKeys?: boolean;
}
