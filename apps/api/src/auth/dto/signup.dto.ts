import { IsEmail, IsString, MinLength } from 'class-validator';
import type { SignupDto } from '@lyra/shared';

// `implements SignupDto` ties this validated shape to the shared contract,
// so the request body can never drift from what web and api agree on.
export class SignupBody implements SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
