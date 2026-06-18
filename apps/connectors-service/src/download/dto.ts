import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
export class ResolveBody { @IsString() @MinLength(1) url!: string; }
export class DownloadBody {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() indices?: number[];
}
