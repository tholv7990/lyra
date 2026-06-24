import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MemoryKind } from '@lyra/shared';
import type { RememberDto, RecallDto } from '@lyra/shared';

const KINDS = Object.values(MemoryKind);

export class RememberBody implements RememberDto {
  @IsString() @IsIn(KINDS) kind!: MemoryKind;
  @IsString() @MinLength(1) @MaxLength(2000) text!: string;
  @IsOptional() @IsIn(['project', 'product', 'brand', 'pipeline', 'global']) subjectType?: RememberDto['subjectType'];
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedIds?: string[];
  @IsOptional() @IsString() @MaxLength(200) dedupeKey?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
  @IsOptional() @IsIn(['explicit', 'inferred']) provenance?: 'explicit' | 'inferred';
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsObject() source?: { conversationId?: string; runId?: string };
}
export class RecallBody implements RecallDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsArray() @IsIn(KINDS, { each: true }) kinds?: MemoryKind[];
  @IsOptional() @IsString() @MaxLength(500) query?: string;
  @IsOptional() @IsString() userId?: string;
}
