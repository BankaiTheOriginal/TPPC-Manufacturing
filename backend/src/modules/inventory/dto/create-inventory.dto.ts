import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @IsString()
  @IsNotEmpty()
  itemType!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantityInStock!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  averagePrice!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsDateString()
  @IsNotEmpty()
  receivedDate!: string;

  @IsDateString()
  @IsOptional()
  lastRestockDate?: string;
}
