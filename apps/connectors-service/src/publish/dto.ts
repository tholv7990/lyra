import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import type { PublishDto } from '@lyra/shared';

export class PublishBody implements PublishDto {
  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) channelIds!: string[];
  @IsString() caption!: string;
  @IsArray() @IsString({ each: true }) mediaUrls!: string[];
}
