import {
  IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus, Provider } from '@lyra/shared';
import type { CreateProductDto, UpdateProductDto, SelectProductDto, ProductSource, ProductEconInputs, SaveProductResultDto } from '@lyra/shared';

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
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() compareAtPrice?: number;
  @IsOptional() @IsString() offer?: string;
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
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() compareAtPrice?: number;
  @IsOptional() @IsString() offer?: string;
}

export class SelectProductBody implements SelectProductDto {
  @IsString() @IsNotEmpty() poolProductId!: string;
}

export class SaveProductResultBody implements SaveProductResultDto {
  @IsString() @IsNotEmpty() output!: string;
  @IsEnum(Provider) provider!: Provider;
  @IsString() @IsNotEmpty() model!: string;
  @IsOptional() @IsString() assetUrl?: string;
  @IsOptional() @IsString() assetType?: 'image' | 'video' | 'audio';
  @IsOptional() @IsString() runId?: string;
  @IsOptional() @IsNumber() stepIndex?: number;
}
