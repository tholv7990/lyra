import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MemoryKind } from '@lyra/shared';
import type { RememberDto, RecallDto } from '@lyra/shared';

const KINDS = Object.values(MemoryKind);

// Bounded, validated provenance — replaces a bare @IsObject() that accepted any payload.
// whitelist:true (global pipe) strips unknown keys; the bounds cap stored size.
export class MemorySourceBody {
  @IsOptional() @IsString() @MaxLength(200) conversationId?: string;
  @IsOptional() @IsString() @MaxLength(200) runId?: string;
}

export class RememberBody implements RememberDto {
  @IsString() @IsIn(KINDS) kind!: MemoryKind;
  @IsString() @MinLength(1) @MaxLength(2000) text!: string;
  @IsOptional() @IsIn(['project', 'product', 'brand', 'pipeline', 'global']) subjectType?: RememberDto['subjectType'];
  @IsOptional() @IsString() @MaxLength(200) subjectId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(200, { each: true }) relatedIds?: string[];
  @IsOptional() @IsString() @MaxLength(200) dedupeKey?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
  @IsOptional() @IsIn(['explicit', 'inferred']) provenance?: 'explicit' | 'inferred';
  @IsOptional() @IsString() @MaxLength(200) userId?: string;
  @IsOptional() @ValidateNested() @Type(() => MemorySourceBody) source?: MemorySourceBody;
}
export class RecallBody implements RecallDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsArray() @IsIn(KINDS, { each: true }) kinds?: MemoryKind[];
  @IsOptional() @IsString() @MaxLength(500) query?: string;
  @IsOptional() @IsString() userId?: string;
}
