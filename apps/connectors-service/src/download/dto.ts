import { IsArray, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
export class ResolveBody { @IsString() @MinLength(1) url!: string; }
export class DownloadBody {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) indices?: number[];
  @IsOptional() @IsString() @MinLength(1) format?: string;
}
