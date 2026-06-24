import { IsString, IsUrl, IsOptional, IsIn, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RenderImageDto {
  @IsString()
  imageUrl!: string;

  @IsString()
  logoUrl!: string;

  @IsIn(['tl', 'tr', 'bl', 'br', 'center'])
  position!: string;

  @IsIn(['sm', 'md', 'lg'])
  size!: string;
}

export class ReviewExpectDto {
  @IsOptional()
  @IsIn(['9:16', '1:1', '16:9'])
  aspect?: '9:16' | '1:1' | '16:9';

  @IsOptional()
  @IsNumber()
  minWidth?: number;
}

export class ReviewDto {
  @IsUrl()
  assetUrl!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReviewExpectDto)
  expect?: ReviewExpectDto;
}
