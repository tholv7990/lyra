import { IsEmail, IsString, MinLength } from 'class-validator';
import type { LoginDto } from '@lyra/shared';

export class LoginBody implements LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
