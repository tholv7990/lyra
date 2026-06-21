import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateChannelDto } from '@lyra/shared';

export class CreateChannelBody implements CreateChannelDto {
  @IsString() @MinLength(1) @MaxLength(40) platform!: string;
  @IsString() @MinLength(1) @MaxLength(120) displayName!: string;
  @IsString() @MinLength(1) @MaxLength(200) profileId!: string;
  @IsOptional() @IsString() @MaxLength(300) proxy?: string;
}
