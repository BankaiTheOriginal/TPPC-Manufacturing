import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Priority, ProductCategory, ProductType } from 'generated/prisma/enums';

export class CreateProductionOrderDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsEnum(ProductType)
  @IsNotEmpty()
  productType!: ProductType;

  @IsEnum(ProductCategory)
  @IsNotEmpty()
  productCategory!: ProductCategory;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  orderType!: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsString()
  @IsOptional()
  zohoBooksId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
