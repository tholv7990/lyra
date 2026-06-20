import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
// cookies: a Netscape cookies.txt the api forwards (decrypted) for logged-in/age-gated
// downloads. Server-to-server only; capped to a sane single-blob size.
export class ResolveBody {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(262144) cookies?: string;
}
export class DownloadBody {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) indices?: number[];
  @IsOptional() @IsString() @MinLength(1) format?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(262144) cookies?: string;
}
