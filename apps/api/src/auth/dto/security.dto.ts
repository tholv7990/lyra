import { IsEmail, IsString, MinLength } from 'class-validator';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@lyra/shared';

export class ChangePasswordBody implements ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ForgotPasswordBody implements ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordBody implements ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
