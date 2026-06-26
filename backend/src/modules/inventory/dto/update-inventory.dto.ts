import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInventoryDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  itemName?: string;

  @IsString()
  @IsOptional()
  itemType?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantityInStock?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  averagePrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @IsDateString()
  @IsOptional()
  lastRestockDate?: string;
}
