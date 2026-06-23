import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '@lyra/shared';
import type { CreateProductDto, UpdateProductDto, ProductSource, ProductEconInputs } from '@lyra/shared';

class ProductSourceBody implements ProductSource {
  @IsOptional() @IsString() @MaxLength(60) platform?: string;
  @IsOptional() @IsString() @MaxLength(2000) url?: string;
}
class ProductEconInputsBody implements ProductEconInputs {
  @IsOptional() @IsNumber() targetPrice?: number;
  @IsOptional() @IsNumber() testingBudget?: number;
  @IsOptional() @IsNumber() inventoryBudget?: number;
  @IsOptional() @IsNumber() minPreAdCmPct?: number;
  @IsOptional() @IsNumber() desiredPostAdCmPct?: number;
}

export class CreateProductBody implements CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => ProductSourceBody) source?: ProductSourceBody;
  @IsOptional() @IsString() @MaxLength(120) niche?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @ValidateNested() @Type(() => ProductEconInputsBody) econInputs?: ProductEconInputsBody;
  @IsOptional() @IsArray() @IsString({ each: true }) competitorIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateProductBody implements UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => ProductSourceBody) source?: ProductSourceBody;
  @IsOptional() @IsString() @MaxLength(120) niche?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @ValidateNested() @Type(() => ProductEconInputsBody) econInputs?: ProductEconInputsBody;
  @IsOptional() @IsArray() @IsString({ each: true }) competitorIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
