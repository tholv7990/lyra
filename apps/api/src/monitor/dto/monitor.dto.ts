import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';
import type { DiscoverDto } from '@lyra/shared';

export class DiscoverBody implements DiscoverDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  keywords!: string[];
}
